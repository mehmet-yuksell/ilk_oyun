# Yayın Notları (Android)

Bu dosya, Android için imzalı bir release (yayın) APK/AAB üretmek için gereken adımları
anlatır. **Hiçbir keystore dosyası bu depoya eklenmedi ve eklenmemelidir** -- imzalama anahtarı
kaybolursa uygulamanın Play Store'da GÜNCELLENEMEZ hale gelmesi riski vardır, bu yüzden bu
tamamen elle, güvenli bir yerde (şifre yöneticisi + yedek) yapılması gereken bir adımdır.

## 1. Sürüm numaraları (versionCode / versionName)

`android/app/build.gradle` içinde:

```gradle
versionCode 2
versionName "1.1.0"
```

- `versionCode`: Play Store'un güncellemeleri ayırt etmesi için kullandığı, her yüklemede
  KESİNLİKLE artması gereken bir tam sayı (asla azaltılamaz, asla tekrar kullanılamaz).
- `versionName`: kullanıcıya görünen sürüm metni (serbest format, ör. "1.1.0").

Her yeni Play Store yüklemesinden önce ikisini de güncelleyin (ör. `versionCode 3`,
`versionName "1.1.1"` bir hata düzeltmesi için; `versionName "1.2.0"` yeni bir özellik için).

## 2. Proguard / minify

Release build artık `minifyEnabled true` + `shrinkResources true` ile küçültülüyor
(`android/app/build.gradle`). Bu, Capacitor'ın kendi kütüphane modüllerinin taşıdığı
"consumer proguard" kurallarına güvenir (elle keep kuralı eklemeye gerek kalmadı, çünkü bu
projede özel/native bir Java/Kotlin kodu yok -- tüm oyun mantığı WebView içindeki
JavaScript'te).

**Önemli:** Bu depoda Android SDK/Gradle çalıştırılamadığı için minify açıldıktan sonra
`./gradlew assembleRelease` gerçek bir release build'inin başarıyla tamamlandığı VE üretilen
APK'nın cihazda/emülatörde düzgün açılıp oynanabildiği elle doğrulanmadı. İlk release build'den
önce mutlaka:

```bash
cd android
./gradlew assembleRelease
```

çalıştırıp üretilen APK'yı (`android/app/build/outputs/apk/release/`) gerçek bir cihaza veya
emülatöre yükleyip en az bir seviye oynayarak test edin. Minify bir şeyi kırarsa (olası ama
düşük ihtimal), ilk yapılacak şey `android/app/build.gradle`de `minifyEnabled false` yaparak
geri almak, sonra hangi sınıfın/metodun yanlışlıkla küçültüldüğünü loglardan bulup
`proguard-rules.pro`ya özel bir `-keep` kuralı eklemektir.

## 3. İmzalama anahtarı (keystore) oluşturma

**Bu adım elle, tek seferlik ve dikkatle yapılmalı.** Keystore'u KAYBEDERSENİZ, mevcut
uygulamanın yerine aynı `applicationId` ile yeni bir sürüm yükleyemezsiniz -- Play Store farklı
bir imza olarak reddeder.

```bash
keytool -genkeypair -v \
  -keystore cozy-sort-release.keystore \
  -alias cozy-sort \
  -keyalg RSA -keysize 2048 -validity 10000
```

Sorulan bilgileri (isim, organizasyon, şehir vb.) doldurun ve **iki ayrı güçlü parola**
belirleyin (keystore parolası + anahtar parolası -- aynı da olabilirler ama ayrı tutmak daha
güvenlidir). Bu dosyayı ve parolaları:

- **ASLA git'e eklemeyin** (`.gitignore`'da zaten `*.keystore`/`*.jks` engelli).
- Bir şifre yöneticisinde (ör. 1Password/Bitwarden) VE ayrı bir fiziksel/bulut yedekte saklayın.
- Mümkünse Google Play App Signing'i kullanın (Play Console ilk yüklemede "Google Play
  tarafından imzalansın" seçeneği) -- bu durumda kendi keystore'unuz yalnızca "yükleme anahtarı"
  (upload key) olur ve kaybedilirse Google'dan sıfırlama talep edilebilir; keystore tamamen
  kaybolsa bile uygulama kalıcı olarak kilitlenmez.

## 4. Gradle'a imzalama bilgisini vermek

Keystore'u asla `build.gradle`e açık metin olarak yazmayın. Parolaları ortam değişkenlerinden
veya git'e girmeyen yerel bir `keystore.properties` dosyasından okuyun:

`android/keystore.properties` (bu dosyayı da `.gitignore`'a ekleyin, zaten git'e girmemiş
olmalı):

```properties
storeFile=../cozy-sort-release.keystore
storePassword=***
keyAlias=cozy-sort
keyPassword=***
```

`android/app/build.gradle`e (release build'den ÖNCE, elle) eklenecek imzalama bloğu:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            // ... (mevcut minifyEnabled/shrinkResources/proguardFiles aynen kalır)
        }
    }
}
```

Bu blok bilerek `build.gradle`ye eklenmedi (keystore henüz yok) -- keystore'u oluşturduğunuzda
yukarıdaki parçayı elle ekleyin.

## 5. Build + yayın adımları (özet)

```bash
npm run build          # web bundle (dist/)
npx cap sync android    # dist/ -> android/app/src/main/assets/public
cd android
./gradlew bundleRelease # Play Store için .aab (önerilen) -- veya assembleRelease (.apk)
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab` (Play Console'a yüklenecek
dosya).
