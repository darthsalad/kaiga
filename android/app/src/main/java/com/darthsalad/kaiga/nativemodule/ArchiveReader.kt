package com.darthsalad.kaiga.nativemodule

import net.sf.sevenzipjbinding.ExtractAskMode
import net.sf.sevenzipjbinding.ExtractOperationResult
import net.sf.sevenzipjbinding.IArchiveExtractCallback
import net.sf.sevenzipjbinding.IInArchive
import net.sf.sevenzipjbinding.IInStream
import net.sf.sevenzipjbinding.ISeekableStream
import net.sf.sevenzipjbinding.ISequentialOutStream
import net.sf.sevenzipjbinding.PropID
import net.sf.sevenzipjbinding.SevenZip
import net.sf.sevenzipjbinding.SevenZipException
import net.sf.sevenzipjbinding.impl.RandomAccessFileInStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.charset.Charset
import java.util.zip.ZipFile

/**
 * Reads comic archives. The format is detected from the file's magic bytes, never its extension:
 * plenty of `.cbr` files are really ZIPs and vice versa.
 *
 * Archives in app storage are opened by path: ZIP through java.util.zip, RAR and 7z through
 * 7-Zip-JBinding. Files read in place from another app (a content:// URI) can't be reopened by
 * path under scoped storage, so they are read through their open file channel, and 7-Zip handles
 * every format, ZIP included. 7-Zip extracts several entries in one pass so solid archives are not
 * re-decoded once per page.
 */
object ArchiveReader {
  data class Entry(val name: String, val size: Long)

  sealed interface Input {
    data class Path(val file: File) : Input
    data class Channel(val channel: FileChannel) : Input
  }

  class CancelledException : Exception("cancelled")

  fun detect(input: Input): String {
    val head = ByteArray(8)
    val read = when (input) {
      is Input.Path -> input.file.inputStream().use { it.read(head) }
      is Input.Channel -> input.channel.read(ByteBuffer.wrap(head), 0)
    }
    if (read < 4) return "unknown"
    fun starts(vararg bytes: Int) = bytes.indices.all { i -> i < read && head[i] == bytes[i].toByte() }
    return when {
      starts(0x50, 0x4B, 0x03, 0x04) || starts(0x50, 0x4B, 0x05, 0x06) || starts(0x50, 0x4B, 0x07, 0x08) -> "zip"
      starts(0x52, 0x61, 0x72, 0x21, 0x1A, 0x07) -> "rar"
      starts(0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C) -> "7z"
      starts(0x25, 0x50, 0x44, 0x46) -> "pdf"
      else -> "unknown"
    }
  }

  fun list(input: Input): Pair<String, List<Entry>> {
    val format = detect(input)
    if (format !in SUPPORTED) throw IllegalArgumentException("Unsupported archive format: $format")
    val entries = if (format == "zip" && input is Input.Path) {
      openZip(input.file).use { zip ->
        zip.entries().asSequence().filter { !it.isDirectory }.map { Entry(it.name, it.size) }.toList()
      }
    } else {
      openSevenZip(input) { archive ->
        (0 until archive.numberOfItems).mapNotNull { i ->
          if (archive.getProperty(i, PropID.IS_FOLDER) as? Boolean == true) return@mapNotNull null
          val name = archive.getStringProperty(i, PropID.PATH) ?: return@mapNotNull null
          Entry(name.replace('\\', '/'), (archive.getProperty(i, PropID.SIZE) as? Long) ?: -1L)
        }
      }
    }
    return format to entries
  }

  /**
   * Extracts the named entries to their destination files. Each file is written to a temp path and
   * renamed when complete, so a reader never sees a half-written page. [onEntry] runs once per
   * entry as soon as it is on disk; [isCancelled] is polled between writes.
   */
  fun extract(
    input: Input,
    names: List<String>,
    dests: List<File>,
    isCancelled: () -> Boolean,
    onEntry: (name: String, dest: File) -> Unit,
  ) {
    val wanted = names.zip(dests).toMap()
    val format = detect(input)
    if (format !in SUPPORTED) throw IllegalArgumentException("Unsupported archive format: $format")
    if (format == "zip" && input is Input.Path) {
      openZip(input.file).use { zip ->
        // keep the caller's order: it puts the page being read first
        for (name in names) {
          if (isCancelled()) throw CancelledException()
          val dest = wanted.getValue(name)
          if (dest.length() > 0) {
            onEntry(name, dest)
            continue
          }
          val entry = zip.getEntry(name) ?: continue
          val tmp = File(dest.path + ".tmp")
          dest.parentFile?.mkdirs()
          zip.getInputStream(entry).use { inp -> tmp.outputStream().use { inp.copyTo(it, BUFFER) } }
          tmp.renameTo(dest)
          onEntry(name, dest)
        }
      }
      return
    }
    openSevenZip(input) { archive ->
      val byIndex = HashMap<Int, String>()
      for (i in 0 until archive.numberOfItems) {
        val name = archive.getStringProperty(i, PropID.PATH)?.replace('\\', '/') ?: continue
        val dest = wanted[name] ?: continue
        if (dest.length() > 0) onEntry(name, dest) else byIndex[i] = name
      }
      if (byIndex.isEmpty()) return@openSevenZip
      // ZIP entries are independent, so pull them in the caller's priority order one at a time;
      // RAR and 7z may be solid, where one ordered pass is far cheaper
      if (format == "zip") {
        val order = names.mapNotNull { n -> byIndex.entries.firstOrNull { it.value == n }?.key }
        for (i in order) {
          if (isCancelled()) throw CancelledException()
          archive.extract(intArrayOf(i), false, Callback(byIndex, wanted, isCancelled, onEntry))
        }
      } else {
        archive.extract(byIndex.keys.sorted().toIntArray(), false, Callback(byIndex, wanted, isCancelled, onEntry))
      }
    }
  }

  private class Callback(
    val byIndex: Map<Int, String>,
    val wanted: Map<String, File>,
    val isCancelled: () -> Boolean,
    val onEntry: (String, File) -> Unit,
  ) : IArchiveExtractCallback {
    private var current: Pair<String, File>? = null
    private var out: FileOutputStream? = null

    override fun getStream(index: Int, mode: ExtractAskMode): ISequentialOutStream? {
      if (isCancelled()) throw SevenZipException("cancelled")
      if (mode != ExtractAskMode.EXTRACT) return null
      val name = byIndex[index] ?: return null
      val dest = wanted.getValue(name)
      dest.parentFile?.mkdirs()
      val tmp = File(dest.path + ".tmp")
      val stream = FileOutputStream(tmp)
      out = stream
      current = name to dest
      return ISequentialOutStream { data ->
        stream.write(data)
        data.size
      }
    }

    override fun prepareOperation(mode: ExtractAskMode) {}

    override fun setOperationResult(result: ExtractOperationResult) {
      out?.close()
      out = null
      val (name, dest) = current ?: return
      current = null
      val tmp = File(dest.path + ".tmp")
      if (result == ExtractOperationResult.OK && tmp.renameTo(dest)) onEntry(name, dest) else tmp.delete()
    }

    override fun setTotal(total: Long) {}

    override fun setCompleted(complete: Long) {
      if (isCancelled()) throw SevenZipException("cancelled")
    }
  }

  /** 7-Zip input over an already-open file channel (positional reads, no reopening by path). */
  private class ChannelInStream(private val channel: FileChannel) : IInStream {
    private var position = 0L

    override fun seek(offset: Long, seekOrigin: Int): Long {
      position = when (seekOrigin) {
        ISeekableStream.SEEK_SET -> offset
        ISeekableStream.SEEK_CUR -> position + offset
        ISeekableStream.SEEK_END -> channel.size() + offset
        else -> throw SevenZipException("Bad seek origin $seekOrigin")
      }
      return position
    }

    override fun read(data: ByteArray): Int {
      if (data.isEmpty()) return 0
      val n = channel.read(ByteBuffer.wrap(data), position)
      if (n <= 0) return 0
      position += n
      return n
    }

    override fun close() {}
  }

  private fun openZip(file: File): ZipFile {
    // older archives store names in CP437; UTF-8 decoding throws on them while iterating
    val utf8 = ZipFile(file)
    return try {
      utf8.entries().asSequence().forEach { it.name }
      utf8
    } catch (e: IllegalArgumentException) {
      utf8.close()
      ZipFile(file, Charset.forName("CP437"))
    }
  }

  private fun <T> openSevenZip(input: Input, block: (IInArchive) -> T): T {
    val raf = (input as? Input.Path)?.let { RandomAccessFile(it.file, "r") }
    try {
      val stream: IInStream = if (raf != null) RandomAccessFileInStream(raf) else ChannelInStream((input as Input.Channel).channel)
      val archive = SevenZip.openInArchive(null, stream)
      try {
        return block(archive)
      } finally {
        archive.close()
      }
    } finally {
      raf?.close()
    }
  }

  private val SUPPORTED = setOf("zip", "rar", "7z")
  private const val BUFFER = 256 * 1024
}
