const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserInputError } = require('apollo-server');

const { validateRegisterInput, validateLoginInput } = require('../../util/validators');
const { SECRET_KEY } = require('../../config.js');
const User = require('../../models/User');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username
    }, 
    SECRET_KEY,
    { expiresIn: '1h' }
  );
}

module.exports = {
  Mutation: {
    async login(_, { username, password }) {
      const { errors, valid } = validateLoginInput(username, password);

      if (!valid) {
        throw new UserInputError('Errors', { errors });
      }

      const user = await User.findOne({ username });

      if (!user) {
        errors.general = 'User not found';
        throw new UserInputError('User not found!', { errors })
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        errors.general = 'Invalid credentials';
        throw new UserInputError('Wrong credentials', { errors })
      }

      const token = generateToken(user);

      return {
        ...user._doc,
        id: user._id,
        token
      };
    },
    async register(
      _,
      { registerInput: { password, username, email, confirmPassword } },
      context,
      info
    ) {
      //valido email, username, password y confirmPassword
      const { valid, errors } = validateRegisterInput({ password, username, email, confirmPassword });
      if (!valid) {
        throw new UserInputError('Errors', { errors });
      }
      //----
      //valido que no exista ya una cuenta con ese username
      const user = await User.findOne({ username });
      if (user) {
        throw new UserInputError('Username is taken', {
          errors: {
            username: 'This username is taken'
          }
        });
      }
      //----
      //ofusco la contraseña antes de guardarla en bd
      password = await bcrypt.hash(password, 12);
      //----
      const newUser = new User({
        email,
        username,
        password,
        createdAt: new Date().toISOString()
      });

      const res = await newUser.save();
      
      const token = generateToken(res);

      return {
        ...res._doc,
        id: res._id,
        token
      };
    }
  }
};