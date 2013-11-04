BASEDIR="$( dirname "${BASH_SOURCE[0]}" )"
ROOTPATH=`realpath "$BASEDIR/../"`

cd $ROOTPATH

echo setting correct interpretor names for project scripts...

echo "bin/patch bin/db nodejs"
bin/patch bin/db nodejs > /dev/null 2>&1

echo "bin/patch bin/account nodejs"
bin/patch bin/account nodejs > /dev/null 2>&1

echo "bin/patch api bash"
bin/patch api bash > /dev/null 2>&1

echo "bin/patch bin/firewall nodejs"
bin/patch bin/firewall nodejs > /dev/null 2>&1

echo "bin/patch bin/network nodejs"
bin/patch bin/network nodejs > /dev/null 2>&1

echo "bin/patch storage bash"
bin/patch storage bash > /dev/null 2>&1

echo "bin/patch worker bash"
bin/patch worker bash > /dev/null 2>&1

echo "bin/patch bin/filmstrip nodejs"
bin/patch bin/filmstrip nodejs > /dev/null 2>&1

echo "bin/patch tools/init-database bash"
bin/patch tools/init-database bash > /dev/null 2>&1

echo "bin/patch tools/install-ffmpeg bash"
bin/patch tools/install-ffmpeg bash > /dev/null 2>&1

echo "bin/patch tools/install-ffmpeg-compile-yasm-1 bash"
bin/patch tools/install-ffmpeg-compile-yasm-1 bash > /dev/null 2>&1

echo "bin/patch tools/install-ffmpeg-compile-x264-2 bash"
bin/patch tools/install-ffmpeg-compile-x264-2 bash > /dev/null 2>&1

echo "bin/patch tools/install-ffmpeg-compile-fdk-aac-3 bash"
bin/patch tools/install-ffmpeg-compile-fdk-aac-3 bash > /dev/null 2>&1

echo "bin/patch tools/install-ffmpeg-compile-vp8-4 bash"
bin/patch tools/install-ffmpeg-compile-vp8-4 bash > /dev/null 2>&1

echo "bin/patch tools/install-ffmpeg-compile-opus-5 bash"
bin/patch tools/install-ffmpeg-compile-opus-5 bash > /dev/null 2>&1

echo "bin/patch tools/install-ffmpeg-compile-ffmpeg-6 bash"
bin/patch tools/install-ffmpeg-compile-ffmpeg-6 bash > /dev/null 2>&1

echo "bin/patch tools/install-node-modules bash"
bin/patch tools/install-node-modules bash > /dev/null 2>&1

echo "bin/patch tools/install-os-files bash"
bin/patch tools/install-os-files bash > /dev/null 2>&1