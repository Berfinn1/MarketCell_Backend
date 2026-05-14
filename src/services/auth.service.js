const { pool } = require('../config/db');
const { HttpError } = require('../utils/httpError');
const {
  hashOpaqueToken,
  generateOpaqueRefreshToken,
  signAccessToken,
  refreshTokenExpiresAt,
} = require('../utils/tokenUtil');
const jwtConfig = require('../config/jwt');

function normalizeGsm(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('90') && digits.length >= 12) {
    return digits.slice(0, 12);
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `90${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('5')) {
    return `90${digits}`;
  }
  if (digits.length >= 10) {
    return digits.startsWith('90') ? digits.slice(0, 12) : `90${digits.replace(/^0+/, '').slice(-10)}`;
  }
  return null;
}

async function register({ gsm }) {
  const normalized = normalizeGsm(gsm);
  if (!normalized || normalized.length < 12) {
    throw new HttpError(400, 'Geçerli bir GSM numarası girin', 'INVALID_GSM');
  }

  await pool.query(`DELETE FROM otp_challenges WHERE gsm = $1 AND consumed = false`, [
    normalized,
  ]);

  await pool.query(
    `INSERT INTO otp_challenges (gsm, otp_code, expires_at)
     VALUES ($1, $2, now() + interval '15 minutes')`,
    [normalized, '1234']
  );

  return {
    gsm: normalized,
    message: 'OTP simülasyonu: doğrulama kodu 1234',
    expires_in_seconds: 900,
  };
}

async function verifyOtp({ gsm, otp }) {
  const normalized = normalizeGsm(gsm);
  if (!normalized) {
    throw new HttpError(400, 'Geçerli bir GSM numarası girin', 'INVALID_GSM');
  }
  if (String(otp) !== '1234') {
    throw new HttpError(400, 'OTP kodu hatalı', 'INVALID_OTP');
  }

  const { rows: challenges } = await pool.query(
    `SELECT id
       FROM otp_challenges
      WHERE gsm = $1
        AND consumed = false
        AND expires_at > now()
   ORDER BY created_at DESC
      LIMIT 1`,
    [normalized]
  );

  if (challenges.length === 0) {
    throw new HttpError(400, 'Geçersiz veya süresi dolmuş OTP oturumu', 'OTP_EXPIRED');
  }

  const challengeId = challenges[0].id;

  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');

    await client.query(`UPDATE otp_challenges SET consumed = true WHERE id = $1`, [challengeId]);

    const { rows: userRows } = await client.query(
      `INSERT INTO users (gsm, role)
       VALUES ($1, 'buyer')
       ON CONFLICT (gsm) DO UPDATE SET gsm = users.gsm
       RETURNING id, gsm, role, store_id, created_at`,
      [normalized]
    );
    user = userRows[0];

    await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [user.id]);

    const refreshPlain = generateOpaqueRefreshToken();
    const refreshHash = hashOpaqueToken(refreshPlain);
    const expiresAt = refreshTokenExpiresAt(jwtConfig.refreshExpiresIn);

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshHash, expiresAt]
    );

    await client.query('COMMIT');

    const accessToken = signAccessToken(user);

    return {
      access_token: accessToken,
      refresh_token: refreshPlain,
      expires_in: jwtConfig.accessExpiresIn,
      user: {
        id: user.id,
        gsm: user.gsm,
        role: user.role,
        store_id: user.store_id,
      },
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

async function refresh({ refresh_token }) {
  if (!refresh_token || typeof refresh_token !== 'string') {
    throw new HttpError(400, 'refresh_token zorunludur', 'INVALID_BODY');
  }

  const hash = hashOpaqueToken(refresh_token);

  const client = await pool.connect();
  /** @type {{ id: string, gsm: string, role: string, store_id: string | null } | null} */
  let user = null;
  let newRefreshPlain = '';
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT rt.id AS rt_id, u.id, u.gsm, u.role, u.store_id
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1
          AND rt.expires_at > now()
        FOR UPDATE`,
      [hash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      throw new HttpError(401, 'Geçersiz veya süresi dolmuş oturum', 'INVALID_REFRESH');
    }

    const row = rows[0];

    await client.query(`DELETE FROM refresh_tokens WHERE id = $1`, [row.rt_id]);

    newRefreshPlain = generateOpaqueRefreshToken();
    const refreshHash = hashOpaqueToken(newRefreshPlain);
    const expiresAt = refreshTokenExpiresAt(jwtConfig.refreshExpiresIn);

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [row.id, refreshHash, expiresAt]
    );

    await client.query('COMMIT');

    user = {
      id: row.id,
      gsm: row.gsm,
      role: row.role,
      store_id: row.store_id,
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }

  const accessToken = signAccessToken(user);

  return {
    access_token: accessToken,
    refresh_token: newRefreshPlain,
    expires_in: jwtConfig.accessExpiresIn,
    user: {
      id: user.id,
      gsm: user.gsm,
      role: user.role,
      store_id: user.store_id,
    },
  };
}

module.exports = {
  register,
  verifyOtp,
  refresh,
  normalizeGsm,
};
