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

# Percorsi: prima le variabili d'ambiente, poi le cartelle di Android Studio su
# Windows (Git Bash), infine quelle di ~/android-tools (Linux/Mac).
if [ -n "${LOCALAPPDATA:-}" ] && [ -d "$LOCALAPPDATA/Android/Sdk" ]; then
  DEF_SDK="$LOCALAPPDATA/Android/Sdk"; DEF_JDK="/c/Program Files/Android/Android Studio/jbr"; DEF_OUT="$HOME/Documents"
else
  DEF_SDK="$HOME/android-tools/sdk"; DEF_JDK="$HOME/android-tools/jdk"; DEF_OUT="$HOME/Documenti"
fi
SDK="${ANDROID_SDK:-$DEF_SDK}"
JDK="${ANDROID_JDK:-$DEF_JDK}"
# build-tools: la 35.0.0 se c'e', altrimenti la piu' recente installata.
BT="$SDK/build-tools/35.0.0"
[ -d "$BT" ] || BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
FIRMA="${FIRMA_DIR:-$HOME/PortafoglioBot-firma}"
export PATH="$JDK/bin:$PATH"
PY="${PYTHON:-$(command -v python3 >/dev/null 2>&1 && python3 -c 'import PIL' 2>/dev/null && echo python3 || echo python)}"

# Su Windows gli strumenti si chiamano .exe o .bat.
tool() { for e in "" .exe .bat; do [ -f "$BT/$1$e" ] && { echo "$BT/$1$e"; return; }; done; echo "$BT/$1"; }

VERSIONE=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' AndroidManifest.xml)
OUT="${OUT_DIR:-$DEF_OUT}/PortafoglioBot-$VERSIONE.apk"
B=build

rm -rf "$B" && mkdir -p "$B/res" "$B/classes" "$B/dex"
cp -r res/. "$B/res/"

echo "1/6 Icone (dalle icone del sito)"
"$PY" - "$B/res" <<'PY'
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
"$(tool aapt2)" compile --dir "$B/res" -o "$B/res.zip"
"$(tool aapt2)" link -o "$B/base.apk" -I "$ANDROID_JAR" --manifest AndroidManifest.xml "$B/res.zip"

echo "3/6 Codice Java"
javac -nowarn --release 11 -classpath "$ANDROID_JAR" -d "$B/classes" $(find src -name '*.java')

echo "4/6 Dex"
"$(tool d8)" --min-api 24 --lib "$ANDROID_JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')
"$PY" -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'a'); z.write(sys.argv[2],'classes.dex'); z.close()" "$B/base.apk" "$B/dex/classes.dex"
"$(tool zipalign)" -f -p 4 "$B/base.apk" "$B/aligned.apk"

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
# Su Windows "file:/c/..." non viene convertito da Git Bash: serve il percorso C:/...
PASSFILE="$FIRMA/password.txt"
command -v cygpath >/dev/null 2>&1 && PASSFILE="$(cygpath -m "$PASSFILE")"
"$(tool apksigner)" sign --ks "$FIRMA/portafoglio.keystore" --ks-key-alias portafoglio \
  --ks-pass "file:$PASSFILE" \
  --out "$B/firmato.apk" "$B/aligned.apk"
"$(tool apksigner)" verify "$B/firmato.apk"

echo "6/6 Copia in $OUT"
mkdir -p "$(dirname "$OUT")"
cp "$B/firmato.apk" "$OUT"
echo "Fatto: $OUT ($(du -h "$OUT" | cut -f1))"
