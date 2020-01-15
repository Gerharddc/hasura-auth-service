FROM node:lts-alpine

RUN apk --update add --virtual build-dependencies build-base python
RUN yarn global add typescript ts-node

COPY index.ts .
COPY package.json .

RUN yarn && apk del build-dependencies

EXPOSE 3000
CMD ["ts-node", "index.ts"]