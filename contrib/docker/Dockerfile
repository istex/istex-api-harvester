FROM node:4

RUN apt-get update && apt-get install -qyy jq wcalc curl

RUN npm install -g istex-api-harvester

RUN sed -i -e "s;^#\!/usr/bin/env node;#\!/usr/local/bin/node --stack-size=32000;" /usr/local/lib/node_modules/istex-api-harvester/istex-api-harvester.njs

ARG XTRACTGID
ARG XTRACTUID

RUN groupadd -g $XTRACTGID harvester && useradd -u $XTRACTUID -g harvester -d /harvester -m harvester
USER harvester
