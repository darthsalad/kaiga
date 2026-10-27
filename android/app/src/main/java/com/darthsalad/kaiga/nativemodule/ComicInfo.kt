package com.darthsalad.kaiga.nativemodule

import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import java.io.File

/** Reads the ComicRack ComicInfo.xml that many CBZ/CBR files carry. */
object ComicInfo {
  /** XML element name to the key JS sees */
  val FIELDS = mapOf(
    "Title" to "title",
    "Series" to "series",
    "Number" to "number",
    "Count" to "count",
    "Volume" to "volume",
    "Year" to "year",
    "Month" to "month",
    "Summary" to "summary",
    "Notes" to "notes",
    "Writer" to "writer",
    "Penciller" to "penciller",
    "Inker" to "inker",
    "CoverArtist" to "coverArtist",
    "Publisher" to "publisher",
    "Genre" to "genre",
    "Manga" to "manga",
    "LanguageISO" to "languageIso",
  )

  /** Values of the known top-level fields, trimmed; unknown and empty fields are left out. */
  fun parse(file: File): Map<String, String> {
    val out = HashMap<String, String>()
    file.inputStream().use { stream ->
      val parser = Xml.newPullParser()
      parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
      parser.setInput(stream, null)
      var event = parser.eventType
      while (event != XmlPullParser.END_DOCUMENT) {
        // depth 2: children of <ComicInfo>; nested lists such as <Pages> are skipped
        if (event == XmlPullParser.START_TAG && parser.depth == 2) {
          val key = FIELDS[parser.name]
          if (key != null) {
            val text = runCatching { parser.nextText() }.getOrNull()?.trim()
            if (!text.isNullOrEmpty()) out[key] = text
          }
        }
        event = parser.next()
      }
    }
    return out
  }
}
