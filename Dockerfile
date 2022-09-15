FROM alpine:3.16.2
RUN apk add --no-cache \
    g++ \
    libstdc++ \
  && apk del --purge \
    g++
ADD index /register-agent
ENTRYPOINT ["/register-agent"]
