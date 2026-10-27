package com.darthsalad.kaiga.nativemodule

import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.view.HapticFeedbackConstants
import android.view.WindowManager
import com.darthsalad.kaiga.MainActivity
import com.darthsalad.kaiga.specs.NativeKaigaSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileNotFoundException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

class KaigaNativeModule(reactContext: ReactApplicationContext) : NativeKaigaSpec(reactContext) {
  // copies are I/O bound and can run alongside extraction; extraction is CPU and memory heavy
  private val copyPool = Executors.newFixedThreadPool(2)
  private val extractPool = Executors.newFixedThreadPool(2)
  private val miscPool = Executors.newSingleThreadExecutor()
  private val cancelled = ConcurrentHashMap.newKeySet<String>()

  override fun getName() = NAME

  override fun invalidate() {
    copyPool.shutdownNow()
    extractPool.shutdownNow()
    miscPool.shutdownNow()
    super.invalidate()
  }

  override fun hideSplash() {
    MainActivity.keepSplash = false
  }

  override fun haptic(kind: String) {
    val view = reactApplicationContext.currentActivity?.window?.decorView ?: return
    val effect = if (kind == "long") HapticFeedbackConstants.LONG_PRESS else HapticFeedbackConstants.VIRTUAL_KEY
    view.post { view.performHapticFeedback(effect) }
  }

  override fun setKeepScreenOn(on: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (on) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  override fun getDirs(): WritableMap = Arguments.createMap().apply {
    putString("files", reactApplicationContext.filesDir.absolutePath)
    putString("cache", reactApplicationContext.cacheDir.absolutePath)
  }

  override fun getDynamicAccent(): WritableMap? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
    val ctx = reactApplicationContext
    // system_accent1_N holds Material tone (100 - N / 10)
    fun tone(id: Int) = String.format("#%06X", 0xFFFFFF and ctx.getColor(id))
    return Arguments.createMap().apply {
      putString("primaryDark", tone(android.R.color.system_accent1_200))
      putString("onPrimaryDark", tone(android.R.color.system_accent1_800))
      putString("containerDark", tone(android.R.color.system_accent1_700))
      putString("onContainerDark", tone(android.R.color.system_accent1_100))
      putString("primaryLight", tone(android.R.color.system_accent1_600))
      putString("onPrimaryLight", tone(android.R.color.system_accent1_0))
      putString("containerLight", tone(android.R.color.system_accent1_100))
      putString("onContainerLight", tone(android.R.color.system_accent1_900))
    }
  }

  override fun queryUri(uri: String, promise: Promise) = launch(miscPool, promise) {
    val parsed = Uri.parse(uri)
    val resolver = reactApplicationContext.contentResolver
    resolver.query(parsed, null, null, null, null)?.use { c ->
      if (!c.moveToFirst()) throw FileNotFoundException(uri)
      fun long(col: String) = c.getColumnIndex(col).let { if (it >= 0 && !c.isNull(it)) c.getLong(it) else -1L }
      val nameIdx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      Arguments.createMap().apply {
        putString("name", if (nameIdx >= 0) c.getString(nameIdx) ?: "" else parsed.lastPathSegment ?: "")
        putDouble("size", long(OpenableColumns.SIZE).toDouble())
        putDouble("lastModified", long(DocumentsContract.Document.COLUMN_LAST_MODIFIED).toDouble())
        putString("authority", parsed.authority ?: "")
      }
    } ?: throw FileNotFoundException(uri)
  }

  override fun hasUriPermission(uri: String): Boolean {
    val parsed = Uri.parse(uri)
    return reactApplicationContext.contentResolver.persistedUriPermissions.any { it.uri == parsed && it.isReadPermission }
  }

  override fun releaseUriPermission(uri: String) {
    val parsed = Uri.parse(uri)
    val resolver = reactApplicationContext.contentResolver
    resolver.persistedUriPermissions.filter { it.uri == parsed }.forEach {
      var flags = 0
      if (it.isReadPermission) flags = flags or android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
      if (it.isWritePermission) flags = flags or android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      runCatching { resolver.releasePersistableUriPermission(parsed, flags) }
    }
  }

  override fun copyUri(jobId: String, uri: String, destPath: String, promise: Promise) = launch(copyPool, promise) {
    val parsed = Uri.parse(uri)
    val resolver = reactApplicationContext.contentResolver
    val total = runCatching {
      resolver.query(parsed, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else -1L
      } ?: -1L
    }.getOrDefault(-1L)

    val dest = File(destPath)
    dest.parentFile?.mkdirs()
    val part = File("$destPath.part")
    var bytes = 0L
    var lastEmit = 0L
    try {
      val input = resolver.openInputStream(parsed) ?: throw FileNotFoundException(uri)
      input.use { inp ->
        part.outputStream().use { out ->
          val buf = ByteArray(256 * 1024)
          while (true) {
            if (cancelled.remove(jobId)) throw ArchiveReader.CancelledException()
            val n = inp.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            bytes += n
            val now = SystemClock.uptimeMillis()
            if (now - lastEmit > 200) {
              lastEmit = now
              emitProgress(jobId, bytes, total)
            }
          }
        }
      }
      if (dest.exists()) dest.delete()
      if (!part.renameTo(dest)) throw IllegalStateException("Could not move download into place")
      emitProgress(jobId, bytes, if (total > 0) total else bytes)
      bytes.toDouble()
    } catch (e: Exception) {
      part.delete()
      throw e
    }
  }

  override fun cancelJob(jobId: String) {
    cancelled.add(jobId)
  }

  /**
   * Walks a folder picked with ACTION_OPEN_DOCUMENT_TREE and returns every comic archive in it,
   * skipping hidden folders. Paths are relative to the picked folder.
   */
  override fun listTree(treeUri: String, promise: Promise) = launch(miscPool, promise) {
    val tree = Uri.parse(treeUri)
    val resolver = reactApplicationContext.contentResolver
    val out = Arguments.createArray()
    val columns = arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED,
    )
    // iterative walk so very deep trees can't overflow the stack
    val pending = ArrayDeque<Pair<String, String>>()
    pending.add(DocumentsContract.getTreeDocumentId(tree) to "")
    val seen = HashSet<String>()
    while (pending.isNotEmpty()) {
      val (docId, prefix) = pending.removeFirst()
      if (!seen.add(docId) || prefix.count { it == '/' } > MAX_DEPTH) continue
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId)
      resolver.query(children, columns, null, null, null)?.use { c ->
        while (c.moveToNext()) {
          val id = c.getString(0) ?: continue
          val name = c.getString(1) ?: continue
          if (name.startsWith(".")) continue
          val path = if (prefix.isEmpty()) name else "$prefix/$name"
          if (c.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR) {
            pending.add(id to path)
          } else if (COMIC_FILE.matches(name)) {
            out.pushMap(Arguments.createMap().apply {
              putString("uri", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString())
              putString("documentId", id)
              putString("name", name)
              putString("path", path)
              putDouble("size", if (c.isNull(3)) -1.0 else c.getLong(3).toDouble())
              putDouble("lastModified", if (c.isNull(4)) -1.0 else c.getLong(4).toDouble())
            })
          }
        }
      }
    }
    out
  }

  override fun listArchive(path: String, promise: Promise) = launch(extractPool, promise) {
    val (format, entries) = withArchive(path) { ArchiveReader.list(it) }
    Arguments.createMap().apply {
      putString("format", format)
      putArray("entries", Arguments.createArray().apply {
        entries.forEach { e ->
          pushMap(Arguments.createMap().apply {
            putString("name", e.name)
            putDouble("size", e.size.toDouble())
          })
        }
      })
    }
  }

  override fun readComicInfo(archivePath: String, entryName: String, promise: Promise) =
    launch(extractPool, promise) {
      val dest = File(reactApplicationContext.cacheDir, "comicinfo-${System.nanoTime()}.xml")
      try {
        withArchive(archivePath) { archive ->
          ArchiveReader.extract(archive, listOf(entryName), listOf(dest), { false }) { _, _ -> }
        }
        val info = ComicInfo.parse(dest)
        Arguments.createMap().apply {
          ComicInfo.FIELDS.values.forEach { key -> putString(key, info[key] ?: "") }
        }
      } finally {
        dest.delete()
      }
    }

  override fun extractEntries(
    jobId: String,
    archivePath: String,
    names: ReadableArray,
    destPaths: ReadableArray,
    promise: Promise,
  ) = launch(extractPool, promise) {
    val nameList = (0 until names.size()).map { names.getString(it) ?: "" }
    val destList = (0 until destPaths.size()).map { File(destPaths.getString(it) ?: "") }
    try {
      withArchive(archivePath) { archive ->
        ArchiveReader.extract(archive, nameList, destList, { cancelled.contains(jobId) }) { name, dest ->
          val size = Images.size(dest)
          emitOnPageExtracted(Arguments.createMap().apply {
            putString("jobId", jobId)
            putString("name", name)
            putString("path", dest.absolutePath)
            putDouble("width", size.width.toDouble())
            putDouble("height", size.height.toDouble())
          })
        }
      }
      null
    } finally {
      cancelled.remove(jobId)
    }
  }

  override fun makeThumbnail(srcPath: String, destPath: String, maxWidth: Double, promise: Promise) =
    launch(miscPool, promise) {
      val t = Images.thumbnail(File(srcPath), File(destPath), maxWidth.toInt())
      Arguments.createMap().apply {
        putDouble("width", t.width.toDouble())
        putDouble("height", t.height.toDouble())
        putString("color", t.color)
      }
    }

  override fun imageSize(path: String, promise: Promise) = launch(miscPool, promise) {
    val s = Images.size(File(path))
    Arguments.createMap().apply {
      putDouble("width", s.width.toDouble())
      putDouble("height", s.height.toDouble())
    }
  }

  override fun pathExists(path: String): Boolean = File(path).exists()

  override fun pathSize(path: String, promise: Promise) = launch(miscPool, promise) {
    File(path).walkTopDown().filter { it.isFile }.sumOf { it.length() }.toDouble()
  }

  override fun deletePath(path: String, promise: Promise) = launch(miscPool, promise) {
    File(path).deleteRecursively()
    null
  }

  /**
   * Opens an archive given either a file path or a content:// URI. Files that already live on the
   * phone are read in place through their descriptor instead of being copied first.
   */
  private fun <T> withArchive(source: String, block: (ArchiveReader.Input) -> T): T {
    if (!source.startsWith("content://")) return block(ArchiveReader.Input.Path(File(source)))
    // the descriptor is readable, but reopening it by path (/proc/self/fd/N) is denied under
    // scoped storage, so read through its channel
    val pfd = reactApplicationContext.contentResolver.openFileDescriptor(Uri.parse(source), "r")
      ?: throw FileNotFoundException(source)
    // only the ParcelFileDescriptor closes the fd; closing the stream as well would close it twice
    return pfd.use { fd -> block(ArchiveReader.Input.Channel(java.io.FileInputStream(fd.fileDescriptor).channel)) }
  }

  private fun emitProgress(jobId: String, bytes: Long, total: Long) {
    emitOnCopyProgress(Arguments.createMap().apply {
      putString("jobId", jobId)
      putDouble("bytes", bytes.toDouble())
      putDouble("total", total.toDouble())
    })
  }

  private fun launch(pool: java.util.concurrent.ExecutorService, promise: Promise, block: () -> Any?) {
    pool.execute {
      try {
        promise.resolve(block())
      } catch (e: ArchiveReader.CancelledException) {
        promise.reject("E_CANCELLED", "Cancelled", e)
      } catch (e: SecurityException) {
        promise.reject("E_NO_ACCESS", e.message ?: "Access to the file was revoked", e)
      } catch (e: FileNotFoundException) {
        promise.reject("E_NOT_FOUND", e.message ?: "File not found", e)
      } catch (e: net.sf.sevenzipjbinding.SevenZipException) {
        val code = if (e.message == "cancelled") "E_CANCELLED" else "E_ARCHIVE"
        promise.reject(code, e.message ?: "Could not read archive", e)
      } catch (e: Throwable) {
        promise.reject("E_FAILED", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  companion object {
    const val NAME = "KaigaNative"
    private const val MAX_DEPTH = 12
    private val COMIC_FILE = Regex(".*\\.(cbz|cbr|cb7|zip|rar|7z)$", RegexOption.IGNORE_CASE)
  }
}
