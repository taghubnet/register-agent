FROM node:16.14.0-alpine
RUN mkdir /app
COPY *.js /app/
COPY *.json /app/
WORKDIR /app
RUN npm install
ENTRYPOINT ["npm","start"]
