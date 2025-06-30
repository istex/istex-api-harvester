#!/bin/bash

idIstex="$1"
outputDir="$2"
modsUrl="http://vp-istex2-api.intra.inist.fr:63332/document/$idIstex/metadata/mods?sid=harvester"
modsSubDir="$outputDir/${idIstex:0:1}/${idIstex:1:1}/${idIstex:2:1}"
modsPath="$modsSubDir/$idIstex.metadata.mods.xml"

# echo "Url: $modsUrl"
# echo "Path: $modsPath"
mkdir -p "$modsSubDir"

curl -XGET $modsUrl --output "$modsPath" --create-dirs --retry 3 --retry-connrefused --connect-timeout 20 -s
if [ $? -ne 0 ] ; then
  echo "🚨 mods $idIstex not downloaded"
else
  echo "mods $idIstex successfully downloaded"
fi

# possibilité de jouer avec les options
# --rate 2/s
# traiter plusieurs URL en même temps



# grep "^id"  oup.corpus | cut -d ' ' -f 2 | head -10 | parallel --gnu -j 3 -I {} ./harvest-mods.sh {} output

