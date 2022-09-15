FROM alpine:3.16.2
RUN apk add --update nodejs npm
RUN mkdir /app
COPY *.js /app/
COPY *.json /app/
WORKDIR /app
RUN npm install
ENTRYPOINT ["/usr/bin/node"]
