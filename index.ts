import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import knex from 'knex';
import * as fs from 'fs';
import { ApolloServer, gql } from 'apollo-server-fastify';

const app = Fastify();
const gqlapp = Fastify();

const pg = knex({
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING,
});

const USER_TABLE = process.env.USER_TABLE;
const KEY = fs.readFileSync('/etc/jwtkeys/jwt.key');
const KEY_PUB = fs.readFileSync('/etc/jwtkeys/jwt.key.pub');

const typeDefs = gql`
    type Query {
        no_op: String
    }

    type Mutation {
        update_Password(currentPassword: String!, newPassword: String!): Boolean
    }
`

const resolvers = {
    Query: {
        no_op: () => {
            return 'I do nothing';
        }
    },
    Mutation: {
        update_Password: async (_, { currentPassword, newPassword }, context) => {
            const id = context.request.headers['x-hasura-user-id'];

            const user = await pg(USER_TABLE).where({ id }).first();
            if (!user) {
                throw new Error(`User does not exist`);
            }

            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) {
                throw new Error('Invalid current password provided');
            }

            await pg(USER_TABLE)
                .where({ id })
                .update({ password: newPassword });

            return true;
        }
    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
});
gqlapp.register(server.createHandler());

app.get('/', (req, res) => {
    res.send('Service running');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(500).send('Invalid request');
    }

    const testUser = await pg(USER_TABLE).where({ username }).first();

    if (!testUser) {
        return res.send('Invalid login');
    }

    const valid = await bcrypt.compare(password, testUser.password);

    if (!valid) {
        return res.send('Invalid login');
    }

    const claim = {
        // TODO: find a better way to asign the default role

        name: testUser.username,
        'https://hasura.io/jwt/claims': {
            'x-hasura-allowed-roles': testUser.roles,
            'x-hasura-default-role': testUser.roles[0],
            'x-hasura-user-id': testUser.id.toString()
        }
    };

    jwt.sign(claim, KEY, { expiresIn: '1d', algorithm: 'RS256' }, (err, token) => {
        if (err) {
            res.status(500).send(JSON.stringify(err));
        } else {
            res.send({ token });
        }
    });
});

app.post('/verifyToken', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(500).send('Invalid request');
    }

    jwt.verify(token, KEY_PUB, (err, decoded) => {
        if (err) {
            res.send({ valid: false });
        } else {
            // TODO: also ensure that the user still exists

            res.send({ valid: true });
        }
    });
});

app.listen(3000, '0.0.0.0', (err, address) => {
    if (err) {
        app.log.error(err)
        process.exit(1)
    }

    app.log.info(`server listening on ${address}`);
});

gqlapp.listen(80, '0.0.0.0', (err, address) => {
    if (err) {
        gqlapp.log.error(err)
        process.exit(1)
    }

    gqlapp.log.info(`gql server listening on ${address}`);
});
