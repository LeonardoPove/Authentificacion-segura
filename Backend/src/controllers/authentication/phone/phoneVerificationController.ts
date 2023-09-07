// phoneVerificationController.ts
import { Request, Response } from 'express';
import { User } from '../../../models/authModel';
import twilio from 'twilio';
import { errorMessages, successMessages } from '../../../middleware/messages';
import { generateVerificationCode } from '../../../utils/generateCode';

const PHONE_VERIFICATION_LOCK_TIME_MINUTES = 15;

// Función para enviar el código de verificación por SMS
export const sendVerificationCode = async (req: Request, res: Response) => {
    const { username, phoneNumber } = req.body;
  
    // Verificar que todos los campos obligatorios estén presentes en la solicitud
    if (!username || !phoneNumber) {
      return res.status(400).json({
        msg: errorMessages.requiredFields,
      });
    }
  
    try {
      // Validamos si el usuario ya existe en la base de datos
      const user: any = await User.findOne({ where: { username: username } });
  
      if (!user) {
        return res.status(400).json({
          msg: errorMessages.userNotExists(username),
        });
      }
  
      // Verificar si el usuario ya está verificado
      if (user.isVerified) {
        return res.status(400).json({
          msg: errorMessages.userAlreadyVerified,
        });
      }
      
       // Verificar si el número de teléfono ya está registrado
      if (user.phoneNumber) {
        return res.status(400).json({
          msg: errorMessages.phoneNumberExists,
        });
      }
      
      const existingUserWithPhoneNumber = await User.findOne({ where: { phoneNumber: phoneNumber } });

      if (existingUserWithPhoneNumber) {
        return res.status(400).json({
          msg: errorMessages.phoneNumberInUse,
        });
      }
      // Generar el código de verificación único
      const verificationCode = generateVerificationCode();
  
      // Guardar usuario en la base de datos con el código de verificación y número de teléfono
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + PHONE_VERIFICATION_LOCK_TIME_MINUTES);
  
      await User.update(
        {
          phoneNumber: phoneNumber,
          verificationCode: verificationCode,
          verificationCodeExpiration: expirationDate, // Establecer la fecha de expiración del código
          isPhoneVerified: false,
        },
        { where: { username: username } }
      );
  
      // Crear un cliente de Twilio para enviar el mensaje de SMS
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
      // Enviar el código de verificación por SMS
      client.messages
        .create({
          body: `Tu código de verificación es: ${verificationCode}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber,
        })
        .then((message) => {
          console.log('Código de verificación enviado por SMS:', message.sid);
          res.json({
            msg: successMessages.verificationCodeSent,
          });
        })
        .catch((error) => {
          console.error('Error al enviar el código de verificación por SMS:', error);
          res.status(500).json({
            msg: errorMessages.phoneNumberVerificationError,
            error,
          });
        });
    } catch (error) {
      res.status(400).json({
        msg: errorMessages.databaseError,
        error,
      });
    }
  };
  
 
  
  // Función para verificar el código de verificación recibido por SMS
  export const verifyPhoneNumber = async (req: Request, res: Response) => {
    const { username, phoneNumber, verificationCode } = req.body;
  
    // Validamos si el usuario existe en la base de datos
    const user: any = await User.findOne({ where: { username: username } });
  
    if (!user) {
      return res.status(400).json({
        msg: errorMessages.userNotExists(username),
      });
    }
  
    // Verificar si el usuario ya está verificado con el correo electrónico
    if (!user.isEmailVerified) {
      return res.status(400).json({
        msg: errorMessages.userNotVerified,
      });
    }
  
    // Verificar si el número de teléfono coincide con el almacenado en la base de datos
    if (user.phoneNumber !== phoneNumber) {
      return res.status(400).json({
        msg: errorMessages.incorrectPhoneNumber,
      });
    }
  
    // Verificar si el número de teléfono ya ha sido verificado previamente
    if (user.isPhoneVerified) {
      return res.status(400).json({
        msg: errorMessages.phoneAlreadyVerified,
      });
    }
  
    // Verificar si el código de verificación es válido
    if (user.verificationCode !== verificationCode) { 
      return res.status(400).json({ 
        msg: errorMessages.invalidVerificationCode,
      });
    }
  
    // Actualizar el registro del usuario para marcar el número de teléfono como verificado
    try {
      await User.update(
        { isPhoneVerified: true },
        { where: { username: username } }
      );
  
      // Si el correo electrónico también está verificado, actualizamos isVerified a true
      if (user.isEmailVerified) {
        await User.update(
          { isVerified: true },
          { where: { username: username } }
        );
      }
  
      res.json({
        msg: successMessages.phoneVerified,
      });
    } catch (error) {
      res.status(400).json({
        msg: errorMessages.databaseError,
        error,
      });
    }
  };
  
  export const resendVerificationCodeSMS = async (req: Request, res: Response) => {
    const { username } = req.body;
  
    // Validamos si el usuario existe en la base de datos
    const user: any = await User.findOne({ where: { username: username } });
  
    if (!user) {
      return res.status(400).json({
        msg: errorMessages.userNotExists(username),
      });
    }
  
    // Verificar si el usuario ya está verificado
    if (user.isPhoneVerified) {
      return res.status(400).json({
        msg: errorMessages.phoneAlreadyVerified,
      });
    }
  
    // Generar un nuevo código de verificación
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
    // Actualizar la información del usuario en la base de datos con el nuevo código y la nueva fecha de expiración
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + PHONE_VERIFICATION_LOCK_TIME_MINUTES);
  
    try {
      await User.update(
        {
          verificationCode: newVerificationCode,
          verificationCodeExpiration: expirationDate,
        },
        { where: { username: username } }
      );
  
      // Enviar el nuevo código de verificación por SMS
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
      client.messages
        .create({
          body: `Tu nuevo código de verificación por SMS es: ${newVerificationCode}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: user.phoneNumber,
        })
        .then((message) => {
          console.log('Nuevo código de verificación enviado por SMS:', message.sid);
          res.json({
            msg: successMessages.verificationCodeSent,
          });
        })
        .catch((error) => {
          console.error('Error al enviar el nuevo código de verificación por SMS:', error);
          res.status(500).json({
            msg: errorMessages.phoneNumberVerificationError,
            error,
          });
        });
    } catch (error) {
      res.status(400).json({
        msg: errorMessages.databaseError,
        error,
      });
    }
  };