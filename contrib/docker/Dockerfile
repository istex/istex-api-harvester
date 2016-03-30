FROM node:4

RUN apt-get update && apt-get install -qyy jq wcalc curl

RUN npm install -g istex-api-harvester

ARG XTRACTGID
ARG XTRACTUID

RUN groupadd -g $XTRACTGID harvester && useradd -u $XTRACTUID -g harvester -d /harvester -m harvester
USER harvester
