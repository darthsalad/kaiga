# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# 7-Zip-JBinding: its native library looks up these classes, fields and methods by name,
# and the AAR ships no consumer rules of its own.
-keep class net.sf.sevenzipjbinding.** { *; }
-dontwarn net.sf.sevenzipjbinding.**

# Kaiga's callbacks that 7-Zip-JBinding's native code calls (the stream ArchiveReader hands it,
# and the extract callbacks).
-keep class * implements net.sf.sevenzipjbinding.IInStream { *; }
-keep class * implements net.sf.sevenzipjbinding.ISequentialOutStream { *; }
-keep class * implements net.sf.sevenzipjbinding.IArchiveExtractCallback { *; }
-keep class * implements net.sf.sevenzipjbinding.IArchiveOpenCallback { *; }
