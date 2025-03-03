const puppeteer = require('puppeteer');
const axios = require('axios');
const readline = require('readline');
const randomUseragent = require('random-useragent');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let authToken = ''; 


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createEmail() {
    const domain = 'edny.net';
    const email = `user${Math.random().toString(36).substring(7)}@${domain}`;
    const password = "password123";
    const userAgent = randomUseragent.getRandom();

    await axios.post('https://api.mail.tm/accounts', { address: email, password: password }, {
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/json'
        }
    });
    const loginRes = await axios.post('https://api.mail.tm/token', { address: email, password: password }, {
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/json'
        }
    });
    authToken = loginRes.data.token;

    console.log(`✅ Email berhasil dibuat: ${email}`);
    return email;
}

async function getOTP(email) {
    console.log("⌛ Menunggu kode OTP...");
    const userAgent = randomUseragent.getRandom();
    for (let i = 0; i < 30; i++) {
        await delay(5000);
        const response = await axios.get('https://api.mail.tm/messages', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'User-Agent': userAgent
            }
        });
        const messages = response.data['hydra:member'];
        for (const msg of messages) {
            if (msg.to[0].address === email) {
                const mailDetail = await axios.get(`https://api.mail.tm/messages/${msg.id}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'User-Agent': userAgent
                    }
                });
                const otpMatch = mailDetail.data.text.match(/\b\d{6}\b/);
                if (otpMatch) return otpMatch[0];
            }
        }
    }
    return null;
}

async function registerOyaChat(email, referralCode) {
    const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

    const page = await browser.newPage();
    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(userAgent);
    await page.goto(`https://oyachat.com/?referral_code=${referralCode}`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#__next > div > div > button', { timeout: 15000 });
    await page.click('#__next > div > div > button');
    await delay(1000);

    await page.waitForSelector('#email-input', { timeout: 15000 });
    await page.type('#email-input', email);
    await delay(1000);

    await page.waitForSelector('#privy-modal-content > div > div.sc-bmzYkS.tmqqB > div.sc-fHjqPf.hoTooY > div > div:nth-child(1) > div > label > button > span:nth-child(1)', { timeout: 15000 });
    await page.click('#privy-modal-content > div > div.sc-bmzYkS.tmqqB > div.sc-fHjqPf.hoTooY > div > div:nth-child(1) > div > label > button > span:nth-child(1)');
    console.log(`📨 Mendaftar OyaChat dengan email: ${email}`);
    await delay(1000);

    const otp = await getOTP(email);
    if (!otp) {
        console.log("⚠️ Gagal mendapatkan kode OTP");
        await browser.close();
        return;
    }

    console.log(`✅ Kode OTP: ${otp}`);

    const otpInputs = await page.$$('#privy-modal-content > div > div.sc-bmzYkS.tmqqB > div.sc-brPLxw.cEKgRp > div.sc-hRJfrW.Rrmku > div.sc-iMWBiJ.ijNJfF > div:nth-child(2) > input');
    for (let i = 0; i < otp.length; i++) {
        await otpInputs[i].type(otp[i]);
    }

    await page.waitForSelector('#privy-modal-content > div > div.sc-bmzYkS.tmqqB > div.sc-uVWWZ.cQAmLB > button.sc-kpDqfm.sc-jlZhew.dSHGLK.inTmNp', { timeout: 15000 });
    await page.click('#privy-modal-content > div > div.sc-bmzYkS.tmqqB > div.sc-uVWWZ.cQAmLB > button.sc-kpDqfm.sc-jlZhew.dSHGLK.inTmNp');
    await delay(1000);

    console.log("🎉 Pendaftaran berhasil!");
    await delay(2000);
    await page.reload({ waitUntil: "networkidle2" });
    console.log("🔄 Halaman telah di-refresh!");

    await browser.close();
}

rl.question("Masukkan kode referral: ", (referralCode) => {
    rl.question("Masukkan jumlah akun yang ingin dibuat: ", async (count) => {
        count = parseInt(count);
        for (let i = 0; i < count; i++) {
            const email = await createEmail();
            await registerOyaChat(email, referralCode);
        }
        rl.close();
    });
});