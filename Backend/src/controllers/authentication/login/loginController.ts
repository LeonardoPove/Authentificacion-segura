import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../../../models/authModel';
import jwt from 'jsonwebtoken';
import { errorMessages, successMessages } from '../../../middleware/messages';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX_NUMBER = /\d/;
const PASSWORD_REGEX_UPPERCASE = /[A-Z]/;
const PASSWORD_REGEX_LOWERCASE = /[a-z]/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_EXPIRATION_HOURS = 24;
const MAX_LOGIN_ATTEMPTS = 5; // Número máximo de intentos fallidos antes del bloqueo

// Controlador para el inicio de sesión
export const loginUser = async (req: Request, res: Response) => {
  const { username, passwordorrandomPassword } = req.body;

  // Validamos si el usuario existe en la base de datos
  const user: any = await User.findOne({ where: { username: username } });

  if (!user) {
    return res.status(400).json({
      msg: errorMessages.userNotExists(username),
    });
  }

  // Verificamos si el usuario ha verificado su correo electrónico
  if (!user.isEmailVerified) {
    return res.status(400).json({
      msg: errorMessages.userNotVerified,
    });
  }

  // Verificamos si el usuario ha verificado su número de teléfono
  if (!user.isPhoneVerified) {
    return res.status(400).json({
      msg: errorMessages.phoneVerificationRequired,
    });
  }

  // Verificar si la cuenta está bloqueada debido a intentos fallidos
  if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    // Si la cuenta está bloqueada, verificamos si ha pasado el tiempo de bloqueo
    const currentDate = new Date();
    if (user.verificationCodeExpiration && user.verificationCodeExpiration > currentDate) {
      // Si aún está dentro del tiempo de bloqueo, respondemos con un mensaje de error
      return res.status(400).json({
        msg: errorMessages.accountLocked,
      });
    } else {
      // Si ha pasado el tiempo de bloqueo, desbloqueamos la cuenta y restablecemos el contador de intentos
      await unlockAccount(username);
    }
  }

  // Validamos si se proporcionó una contraseña o una contraseña aleatoria
  let passwordValid = false;
  if (passwordorrandomPassword.length === 10) {
    // Si la longitud es 10, asumimos que es una contraseña aleatoria
    passwordValid = passwordorrandomPassword === user.randomPassword;
  } else {
    // Caso contrario, se asume que es una contraseña normal
    passwordValid = await bcrypt.compare(passwordorrandomPassword, user.password);
  }

  if (!passwordValid) {
    // Incrementar el contador de intentos fallidos
    await User.update(
      { loginAttempts: user.loginAttempts + 1 },
      { where: { username: username } }
    );

    if (user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
      // Si excede el número máximo de intentos, bloquear la cuenta
      await lockAccount(username);
    }

    return res.status(400).json({
      msg: errorMessages.incorrectPassword(user.loginAttempts + 1),
    });
  }

  // Si la contraseña es válida, restablecer el contador de intentos de inicio de sesión fallidos
  await User.update(
    { loginAttempts: 0 },
    { where: { username: username } }
  );

  if (passwordorrandomPassword.length === 10) {
    // Si se usó una contraseña aleatoria, generamos un token para la recuperación de contraseña
    const resetPasswordToken = jwt.sign(
      {
        username: username,
        rol: user.rol, // Incluir el rol en el token para utilizarlo posteriormente
      },
      process.env.SECRET_KEY || 'pepito123',
      { expiresIn: '1h' } // Cambia el tiempo de expiración según tus necesidades
    );

    return res.json({
      msg: 'Inicio de sesión Recuperación de contraseña',
      token: resetPasswordToken,
    });
  } else {
    // Si se usó una contraseña normal, generamos un token de sesión
    const token = jwt.sign(
      {
        username: username,
        rol: user.rol, // Incluir el rol en el token para utilizarlo posteriormente
      },
      process.env.SECRET_KEY || 'pepito123'
    );

    return res.json({
      msg: successMessages.userLoggedIn,
      token: token,
      rol: user.rol,
    });
  }
};

async function unlockAccount(username: any) {
  try { 
    // Actualiza la cuenta para desbloquearla y restablecer el contador de intentos fallidos
    await User.update(
      { loginAttempts: 0 },
      { where: { username: username } }
    );
  } catch (error) {
    console.error('Error al desbloquear la cuenta:', error);
  }
}

async function lockAccount(username: any) {
  try {
    // Actualiza la cuenta para bloquearla y configurar la expiración del bloqueo (por ejemplo, 3 minutos)
    const currentDate = new Date();
    const expirationDate = new Date(currentDate.getTime() + 1 * 60 * 1000); // 3 minutos de bloqueo
    await User.update(
      { loginAttempts: MAX_LOGIN_ATTEMPTS, verificationCodeExpiration: expirationDate },
      { where: { username: username } }
    );
  } catch (error) {
    console.error('Error al bloquear la cuenta:', error);
  }
}
