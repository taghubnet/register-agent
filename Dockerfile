FROM node:8
RUN mkdir /app
ADD index.js /app/index.js
ADD package.json /app/package.json
WORKDIR /app
RUN yarn install
ENTRYPOINT ["node","/app/index.js"]
