FROM node:alpine

RUN apk --update add --virtual build-dependencies build-base python
RUN yarn global add typescript ts-node nodemon

COPY index.ts .
COPY package.json .

RUN yarn && apk del build-dependencies

EXPOSE 3000
CMD ["nodemon", "index.ts"]