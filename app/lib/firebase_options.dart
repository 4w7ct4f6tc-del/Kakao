// PLACEHOLDER — replace by running (from the app/ folder):
//   dart pub global activate flutterfire_cli
//   flutterfire configure --project=YOUR_PROJECT_ID --platforms=android,ios,windows,web
// That command overwrites this file with your real Firebase config.
// Until then the app runs in offline/guest mode (builder, previews, storyboard
// all still work locally).
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static bool get isPlaceholder => _base.apiKey.startsWith('YOUR_');

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return _base;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return _base.copyWith(appId: 'YOUR_ANDROID_APP_ID');
      case TargetPlatform.iOS:
        return _base.copyWith(appId: 'YOUR_IOS_APP_ID', iosBundleId: 'com.bkafamy.kakao');
      default:
        return _base.copyWith(appId: 'YOUR_WINDOWS_OR_WEB_APP_ID');
    }
  }

  static const FirebaseOptions _base = FirebaseOptions(
    apiKey: 'YOUR_FIREBASE_API_KEY',
    appId: 'YOUR_FIREBASE_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'YOUR_PROJECT_ID',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  );
}
