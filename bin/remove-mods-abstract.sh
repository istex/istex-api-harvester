#!/bin/bash
# 
# Enlève le résumés d'un fichier Mods
# USAGE : ./harvest-and-compress.sh <modsFile> <corpusName>

modsPath="$1"
corpusName="$2"

tmpDir="/dev/shm/harvester/$corpusName"
mkdir -p $tmpDir

modsName=`basename "$modsPath"`
tmpPath="$tmpDir/$modsName"
xmlstarlet ed -P -N mods=http://www.loc.gov/mods/v3 -d '//mods:mods/mods:abstract' "$modsPath" | xmllint --noblanks - > "$tmpPath"

grep '<abstract' "$tmpPath"
hasAbstract=$?

if [ $hasAbstract -eq 0 ]; then
    echo "🚨 abstract non supprimé pour $tmpPath, on arrête.";
    rm "$tmpPath"
    exit 1
fi

mv "$tmpPath" "$modsPath"

exit 0