import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import knex from 'knex';
import * as fs from 'fs';

const GQL = require('fastify-gql');
const app = Fastify();
const pg = knex({
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING,
});

const USER_TABLE = process.env.USER_TABLE;
const KEY = fs.readFileSync('/etc/jwtkeys/jwt.key');
const KEY_PUB = fs.readFileSync('/etc/jwtkeys/jwt.key.pub');

const schema = `
    type Mutation {
        update_Password(currentPassword: String!, newPassword: String!): Boolean
    }
`

const resolvers = {
    Mutation: {
        update_Password: async (_, { currentPassword, newPassword }, context) => {
            const id = context.request.headers['x-hasura-user-id'];

            const user = await pg(USER_TABLE).where({ where: { id } }).first();
            if (!user) {
                throw new Error(`User does not exist`);
            }

            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) {
                throw new Error('Invalid current password provided');
            }

            await pg(USER_TABLE)
                .where({ where: { id } })
                .update({ password: newPassword });

            return true;
        }
    }
}

app.register(GQL, {
    schema,
    resolvers
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(500).send('Invalid request');
    }

    const testUser = await pg(USER_TABLE).where({ where: { username } }).first();

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

app.listen(3000);
