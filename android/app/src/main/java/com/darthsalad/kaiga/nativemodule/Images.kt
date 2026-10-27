package com.darthsalad.kaiga.nativemodule

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import androidx.palette.graphics.Palette
import java.io.File

object Images {
  data class Size(val width: Int, val height: Int)
  data class Thumb(val width: Int, val height: Int, val color: String)

  /** Reads only the image header. Returns -1 sizes for formats Android cannot decode. */
  fun size(file: File): Size {
    val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, opts)
    return Size(opts.outWidth, opts.outHeight)
  }

  /**
   * Writes a WebP thumbnail [maxWidth] wide and returns a muted colour from the image, used to
   * tint the detail screen and reader chrome.
   */
  fun thumbnail(src: File, dest: File, maxWidth: Int): Thumb {
    val bounds = size(src)
    if (bounds.width <= 0) throw IllegalArgumentException("Cannot decode image")
    var sample = 1
    while (bounds.width / (sample * 2) >= maxWidth) sample *= 2
    val decoded = BitmapFactory.decodeFile(src.path, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: throw IllegalArgumentException("Cannot decode image")
    val height = (decoded.height.toLong() * maxWidth / decoded.width).toInt().coerceAtLeast(1)
    val scaled = if (decoded.width > maxWidth) Bitmap.createScaledBitmap(decoded, maxWidth, height, true) else decoded

    val palette = Palette.from(scaled).maximumColorCount(16).generate()
    val swatch = palette.darkMutedSwatch ?: palette.mutedSwatch ?: palette.darkVibrantSwatch ?: palette.dominantSwatch
    val color = String.format("#%06X", 0xFFFFFF and (swatch?.rgb ?: 0x22262E))

    dest.parentFile?.mkdirs()
    val tmp = File(dest.path + ".tmp")
    @Suppress("DEPRECATION")
    val format = if (Build.VERSION.SDK_INT >= 30) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP
    tmp.outputStream().use { scaled.compress(format, 82, it) }
    tmp.renameTo(dest)

    val result = Thumb(scaled.width, scaled.height, color)
    if (scaled !== decoded) scaled.recycle()
    decoded.recycle()
    return result
  }
}
