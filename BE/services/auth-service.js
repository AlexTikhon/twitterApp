const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { createError } = require('../domain/errors');
const { normalizeString, validateUserInput } = require('../domain/validation');

class AuthService {
  constructor({ userRepository, jwtSecret, jwtExpiresInSeconds }) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresInSeconds = jwtExpiresInSeconds;
    this.dummyPasswordHash = bcrypt.hash('constant-time-login-comparison-only', 12);
  }

  async signup(userInput) {
    const input = validateUserInput(userInput);
    const existingUser = await this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw createError('User already exists.', 409);
    }

    try {
      return await this.userRepository.create({
        email: input.email,
        password: await bcrypt.hash(input.password, 12),
        name: input.name
      });
    } catch (error) {
      if (error.code === 11000) {
        throw createError('User already exists.', 409);
      }

      throw error;
    }
  }

  async login(email, password) {
    const normalizedEmail = normalizeString(email).toLowerCase();
    const normalizedPassword = typeof password === 'string' ? password : '';
    const user = await this.userRepository.findByEmail(normalizedEmail);
    const passwordIsSupported = Buffer.byteLength(normalizedPassword, 'utf8') <= 72;
    const passwordHash = user ? user.password : await this.dummyPasswordHash;
    const isEqual = await bcrypt.compare(
      passwordIsSupported ? normalizedPassword : '',
      passwordHash
    );

    if (!user || !passwordIsSupported || !isEqual) {
      throw createError('Invalid email or password.', 401);
    }

    return {
      token: jwt.sign({ email: user.email, userId: user._id.toString() }, this.jwtSecret, {
        expiresIn: this.jwtExpiresInSeconds
      }),
      userId: user._id.toString(),
      expiresIn: this.jwtExpiresInSeconds
    };
  }
}

module.exports = { AuthService };
