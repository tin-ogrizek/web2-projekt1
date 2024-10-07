const express = require('express');
const fs = require('fs');
const https = require('https');
const app = express();

const externalUrl = process.env.RENDER_EXTERNAL_URL;
const PORT = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 4090;

const axios = require('axios');
const qs = require('qs');

const jwksRsa = require('jwks-rsa');
const { expressjwt: jwt } = require('express-jwt');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('./db');
const Ticket = require('./Ticket');

const { auth, requiresAuth } = require('express-openid-connect');

require("dotenv").config();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());

const QRCode = require('qrcode');

sequelize.sync()
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch(err => {
        console.error('Error creating database:', err);
    });

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${process.env.AUTH_SERVER}/.well-known/jwks.json`
    }),
    audience: process.env.AUDIENCE,
    issuer: `${process.env.AUTH_SERVER}/`,
    algorithms: ['RS256']
});


const getOAuthToken = async () => {
    const tokenUrl = `${process.env.AUTH_SERVER}/oauth/token`;

    const data = qs.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        audience: process.env.AUDIENCE
    });

    const config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    try {
        const response = await axios.post(tokenUrl, data, config);
        return response.data.access_token;
    } catch (err) {
        console.error('Error fetching OAuth token: ', err.response?.data || err.message);
        throw new Error('Failed to retrieve access token');
    }
};

const authenticateReq = async (req, res, next) => {
    try {
        const token = await getOAuthToken();

        console.log('OAuth token: ', token);

        req.headers.authorization = `Bearer ${token}`;

        next();
    } catch (err) {
        return res.status(500).send('Error authenticating request');
    }
};

const config = {
    authRequired: false,
    idpLogout: true,
    secret: process.env.SECRET,
    baseURL: externalUrl || `https://localhost:${PORT}`,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: `${process.env.AUTH_SERVER}`,
    clientSecret: process.env.CLIENT_SECRET,
    authorizationParams: {
        response_type: 'code',
    },
};

app.use(auth(config));

app.get("/", async (req, res) => {
    try {
        const counter = await Ticket.count();
        res.render('index', { counter });
    } catch (err) {
        console.error('Error dohvacanje broja karata: ', err);
        res.render('index', { counter: 0 });
    }
});

app.get("/generate", authenticateReq, checkJwt, (req, res) => {
    res.render('generating');
});

app.post("/generate-qrcode", authenticateReq, checkJwt, async (req, res) => {
    const { vatin, first_name, last_name } = req.body;

    if (!vatin || !first_name || !last_name) {
        return res.status(400).json({ error: "Nisu ispunjeni svi traženi podaci: OIB, Ime, Prezime" });
    }

    try {
        const ticketCount = await Ticket.count({ where: { vatin } });

        if (ticketCount >= 3) {
            return res.status(400).json({ error: `OIB ${vatin} već ima generirana 3 QR koda` });
        }

        const newQRcode = await Ticket.create({
            id: uuidv4(),
            vatin,
            first_name,
            last_name,
        });

        console.log(newQRcode);

        let qrCodeData;
        if (externalUrl) {
            qrCodeData = `${externalUrl}/${newQRcode.id}`;
        } else {
            qrCodeData = `https://localhost:4090/${newQRcode.id}`;
        }
        const qrCodeImageUrl = await QRCode.toDataURL(qrCodeData);

        return res.json({ ticketId: newQRcode.id, qrCodeImageUrl });

    } catch (err) {
        console.error('Error generiranje qr koda');
        return res.status(500).json({ error: 'Greška prilikom generiranje QR koda' });
    }
});


app.get("/:id", requiresAuth(), async (req, res) => {
    const ticketId = req.params.id;
    const userName = req.oidc.user.name;

    try {
        const ticket = await Ticket.findOne({ where: { id: ticketId } });

        if (!ticket) {
            return res.status(404).send('Podaci nisu pronadeni');
        }

        const createdAt = new Date(ticket.created_at);
        const day = String(createdAt.getDate()).padStart(2, '0');
        const month = String(createdAt.getMonth() + 1).padStart(2, '0');
        const year = createdAt.getFullYear();
        const hours = String(createdAt.getHours()).padStart(2, '0');
        const minutes = String(createdAt.getMinutes()).padStart(2, '0');
        const seconds = String(createdAt.getSeconds()).padStart(2, '0');

        const formattedDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;


        res.render('info', {
            ticket,
            userName,
            formattedDate
        });
    } catch (err) {
        console.log('Error dohvaćanje karte: ', err);
        res.status(500).send('Server error');
    }
});


// pokretanje servera
if (externalUrl) {
    const hostname = '0.0.0.0';
    app.listen(PORT, hostname, () => {
        console.log(`Server locally running at http://${hostname}:${PORT}/ and from outside on ${externalUrl}`);
    });
} else {
    https.createServer({
        key: fs.readFileSync('server.key'),
        cert: fs.readFileSync('server.cert')
    }, app)
        .listen(port, function () {
            console.log(`Server running at https://localhost:${PORT}/`);
        });
}
