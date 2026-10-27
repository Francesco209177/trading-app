#!/usr/bin/env bash
# ============================================================
#  Costruisce e firma l'APK del Portafoglio Bot, senza Gradle.
#  Uso:  android/build.sh
#  Risultato: ~/Documenti/PortafoglioBot-<versione>.apk
#
#  Per una nuova versione alza versionCode e versionName in
#  AndroidManifest.xml. La chiave di firma sta in ~/PortafoglioBot-firma
#  (fuori dal repo, che e' pubblico): NON perderla, senza di lei il
#  telefono non accetta aggiornamenti e bisogna disinstallare l'app.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_SDK:-$HOME/android-tools/sdk}"
JDK="${ANDROID_JDK:-$HOME/android-tools/jdk}"
BT="$SDK/build-tools/35.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
FIRMA="${FIRMA_DIR:-$HOME/PortafoglioBot-firma}"
export PATH="$JDK/bin:$PATH"

VERSIONE=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' AndroidManifest.xml)
OUT="${OUT_DIR:-$HOME/Documenti}/PortafoglioBot-$VERSIONE.apk"
B=build

rm -rf "$B" && mkdir -p "$B/res" "$B/classes" "$B/dex"
cp -r res/. "$B/res/"

echo "1/6 Icone (dalle icone del sito)"
python3 - "$B/res" <<'PY'
import sys
from pathlib import Path
from PIL import Image
res = Path(sys.argv[1]); icons = Path("../icons")
dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
legacy = Image.open(icons / "icon-512.png").convert("RGBA")
mask = Image.open(icons / "icon-maskable-512.png").convert("RGBA")
for name, k in dens.items():
    d = res / f"mipmap-{name}"; d.mkdir(parents=True, exist_ok=True)
    legacy.resize((round(48 * k),) * 2, Image.LANCZOS).save(d / "ic_launcher.png")
    # Icona adattiva: tela da 108dp, di cui se ne vedono 72. L'icona "maskable"
    # ha il disegno nell'80% centrale: la mettiamo a 90dp, cosi' quell'80% cade
    # proprio nei 72dp visibili. Lo sfondo scuro lo da' il livello di sotto.
    canvas = round(108 * k); side = round(90 * k)
    fg = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    off = (canvas - side) // 2
    fg.paste(mask.resize((side, side), Image.LANCZOS), (off, off))
    fg.save(d / "ic_launcher_foreground.png")
PY

echo "2/6 Risorse e manifest"
"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/base.apk" -I "$ANDROID_JAR" --manifest AndroidManifest.xml "$B/res.zip"

echo "3/6 Codice Java"
javac -nowarn --release 11 -classpath "$ANDROID_JAR" -d "$B/classes" $(find src -name '*.java')

echo "4/6 Dex"
"$BT/d8" --min-api 24 --lib "$ANDROID_JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')
python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'a'); z.write(sys.argv[2],'classes.dex'); z.close()" "$B/base.apk" "$B/dex/classes.dex"
"$BT/zipalign" -f -p 4 "$B/base.apk" "$B/aligned.apk"

echo "5/6 Firma"
if [ ! -f "$FIRMA/portafoglio.keystore" ]; then
  echo "   Prima volta: creo la chiave di firma in $FIRMA"
  mkdir -p "$FIRMA" && chmod 700 "$FIRMA"
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$FIRMA/password.txt"
  chmod 600 "$FIRMA/password.txt"
  keytool -genkeypair -keystore "$FIRMA/portafoglio.keystore" -alias portafoglio \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Portafoglio Bot" \
    -storepass:file "$FIRMA/password.txt" -keypass:file "$FIRMA/password.txt" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$FIRMA/portafoglio.keystore" --ks-key-alias portafoglio \
  --ks-pass "file:$FIRMA/password.txt" \
  --out "$B/firmato.apk" "$B/aligned.apk"
"$BT/apksigner" verify "$B/firmato.apk"

echo "6/6 Copia in $OUT"
mkdir -p "$(dirname "$OUT")"
cp "$B/firmato.apk" "$OUT"
echo "Fatto: $OUT ($(du -h "$OUT" | cut -f1))"
