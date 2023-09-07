// emailVerificationController.ts
import { Request, Response } from 'express';
import { User } from '../../../models/authModel';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { errorMessages, successMessages } from '../../../middleware/messages';

const VERIFICATION_CODE_EXPIRATION_HOURS = 24;

// Función para enviar el código de verificación por correo electrónico
export const sendVerificationEmail = async (email: string, username: string, verificationCode: string) => {
    try {
      // Obtener la ruta absoluta del archivo de plantilla
      const templatePath = path.join(__dirname, '../..', 'templates', 'verificationEmail.html');
  
      // Leer la plantilla HTML desde el archivo
      const emailTemplate = fs.readFileSync(templatePath, 'utf-8');
  
      // Reemplazar los placeholders {{ username }} y {{ verificationCode }} con los valores reales
      const personalizedEmail = emailTemplate.replace('{{ username }}', username).replace('{{ verificationCode }}', verificationCode);
  
      // Crear el transporte de nodemailer globalmente para reutilizarlo
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
        secure: true,
      });
   
      const mailOptions = {
        from: process.env.MAIL_USER,
        to: email,
        subject: 'Verificación de correo electrónico',
        html: personalizedEmail, // Usar el contenido personalizado en el cuerpo del correo
      };
  
      // Enviar el correo de verificación
      await transporter.sendMail(mailOptions);
  
      return true; // Indicar que el correo de verificación fue enviado con éxito
    } catch (error) {
      console.error('Error al enviar el correo de verificación:', error);
      return false; // Indicar que hubo un error al enviar el correo de verificación
    }
  };
  
  
  export const verifyUser = async (req: Request, res: Response) => {
    const { username, verificationCode } = req.body;
  
    // Validamos si el usuario existe en la base de datos
    const user: any = await User.findOne({ where: { username: username } });
  
    if (!user) {
      return res.status(400).json({
        msg: errorMessages.userNotExists(username),
      });
    }
  
    // Verificar si el usuario ya está verificado
    if (user.isEmailVerified) {
      return res.status(400).json({
        msg: errorMessages.userAlreadyVerified,
      });
    }
  
    // Verificar si el código de verificación ha expirado
    const currentDate = new Date();
    if (user.verificationCodeExpiration && user.verificationCodeExpiration < currentDate) {
      return res.status(400).json({
        msg: errorMessages.verificationCodeExpired,
      });
    }
  
    // Verificar si el código de verificación es válido
    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({
        msg: errorMessages.invalidVerificationCode,
      });
    }
  
    // Actualizar el registro del usuario para marcarlo como verificado
    try {
      await User.update(
        { isEmailVerified: true },
        { where: { username: username } }
      );
  
      // Si el número de teléfono también está verificado, actualizamos isVerified a true
      if (user.isPhoneVerified) {
        await User.update(
          { isVerified: true },
          { where: { username: username } }
        );
      }
  
      res.json({
        msg: successMessages.userVerified,
      });
    } catch (error) {
      res.status(400).json({
        msg: errorMessages.databaseError,
        error,
      });
    }
  };
  
  // Función para reenviar el código de verificación por correo electrónico
export const resendVerificationCode = async (req: Request, res: Response) => {
  const { username } = req.body;

  // Validamos si el usuario existe en la base de datos
  const user: any = await User.findOne({ where: { username: username } });

  if (!user) {
    return res.status(400).json({
      msg: errorMessages.userNotExists(username),
    });
  }

  // Verificar si el usuario ya está verificado
  if (user.isEmailVerified) {
    return res.status(400).json({
      msg: errorMessages.userAlreadyVerified,
    });
  }

  // Generar un nuevo código de verificación
  const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Actualizar la información del usuario en la base de datos con el nuevo código y la nueva fecha de expiración
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + VERIFICATION_CODE_EXPIRATION_HOURS);

  try {
    await User.update(
      {
        verificationCode: newVerificationCode,
        verificationCodeExpiration: expirationDate,
      },
      { where: { username: username } }
    );

    // Enviar el nuevo código de verificación por correo electrónico
    const emailSent = await sendVerificationEmail(user.email, user.username, newVerificationCode);

    if (emailSent) {
      res.json({
        msg: successMessages.verificationCodeResent,
      });
    } else {
      res.status(500).json({
        msg: errorMessages.emailVerificationError,
      });
    }
  } catch (error) {
    res.status(400).json({
      msg: errorMessages.databaseError,
      error,
    });
  }
};
