package com.darthsalad.kaiga

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Hold the launch screen until JS has drawn the library, so there is no blank frame between them.
    installSplashScreen().setKeepOnScreenCondition { keepSplash }
    // In case JS never gets there (a crash or a very slow first start), don't hang on the splash.
    Handler(Looper.getMainLooper()).postDelayed({ keepSplash = false }, SPLASH_TIMEOUT_MS)
    // react-native-screens can't restore fragments, so don't hand it the saved state.
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Kaiga"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  companion object {
    private const val SPLASH_TIMEOUT_MS = 4000L

    @Volatile var keepSplash = true
  }
}
