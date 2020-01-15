This is a Docker image that can be used as a simple Node.js based authentication service for use with Hasura. It is extremely lightweight, making use of Fastify to serve its REST and GraphQL endpoints.

To login, clients simply have to post their username and passwords to the '/login' REST endpoint. The server will then either respond with a valid JWT for Hasura if the login is correct or it will return 'Invalid login'.

Clients can also post cached tokens to the '/verifyToken' REST endpoint to determine if their tokens are still valid. The server responds with a JSON object with a single 'valid' boolean property.

Finally the service provides a 'update_Password' GraphQL mutation that clients can use to update their own passwords regardless of their assigned roles. A client simply needs to pass the current password of the user as well as a bcrypt hash of the new password they desire. The current password has to be in cleartext. If the current password is correct then the new password will be stored. The service extracts the id for the user making the request from the Hasura headers, because it is assumed that this GraphQL endpoint is merged in Hasura and thus they should be available.

Passwords unfortunately need to be sent in cleartext for login and changing because bcrypt needs to compare the password to the hash stored in the DB and because the salt is random, clients will not be able to provide the same hash which makes it impossible to compare to the stored hash. It is therefore recommended that all communication be over TLS, especially considering how tokens are also sent back in cleartext as well...

This server assumes that a Postgres DB is used to store user information considering how it is intended to be used in conjunction with Hasura. The name of the table to use is passed in as an environment variable. The only assumption that the service makes is that the table has a 'username' column, an id column, a 'password' column containing bcrypted passwords, and a string array table named 'roles' containing the user's roles.

The following environment variables need to be provided to the service:

| Env Var | Description |
| --- | --- |
| PG_CONNECTION_STRING | The connection string required to connect to the Postgres DB with the user table |
| USER_TABLE | The table that contains the user login details |

The service also requires that an RSA key be provided for JWT token generation and authentication. This key can be generated using the included jwt.sh. The service assumes that these keys are mounted on the '/etc/jwtkeys' folder.