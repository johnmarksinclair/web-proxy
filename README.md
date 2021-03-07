# web-proxy-server

used openssl to generate ssl cert and private key

http and https to create servers and make requests

readline to take user input

fs to decrypt cert

caching chars at 2 bytes each so size is body length x 2

to make the cert - openssl:

```
openssl req -x509 -out localhost.crt -keyout localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

temp
