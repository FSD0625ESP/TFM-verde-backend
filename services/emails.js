const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

// Configuración del transportador de email
const emailConfig = {
    host: process.env.EMAIL_HOST || 'gmail',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
    }
};

// Crear el transportador de nodemailer
const transporter = nodemailer.createTransport(emailConfig);

/**
 * Lee y compila una plantilla de email
 * @param {string} templateName - Nombre del archivo de la plantilla (sin extensión)
 * @returns {Promise<Function>} Plantilla compilada
 */
async function getEmailTemplate(templateName = 'defaultTemplate') {
    const templatePath = path.join(__dirname, '..', 'emails', `${templateName}.html`);
    const template = await fs.readFile(templatePath, 'utf8');
    return handlebars.compile(template);
}

/**
 * Envía un email usando una plantilla
 * @param {Object} options - Opciones del email
 * @param {string} options.to - Destinatario del email
 * @param {string} options.subject - Asunto del email
 * @param {Object} options.templateData - Datos para la plantilla
 * @param {string} [options.templateName] - Nombre de la plantilla a usar (sin extensión)
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendEmail({ to, subject, templateData, templateName = 'defaultTemplate' }) {
    try {
        // Obtener y compilar la plantilla
        const template = await getEmailTemplate(templateName);

        // Preparar los datos para la plantilla
        const emailData = {
            ...templateData,
            CURRENT_YEAR: new Date().getFullYear(),
            EMAIL_TITLE: subject,
            EMAIL_RECIPIENT: to
        };

        // Generar el HTML del email
        const html = template(emailData);

        // Configurar el email
        const mailOptions = {
            from: `Meraki Marketplace <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        };

        // Enviar el email
        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        throw error;
    }
}

/**
 * Envía un email de restablecimiento de contraseña
 * @param {Object} options - Opciones del email
 * @param {string} options.to - Email del usuario
 * @param {string} options.firstName - Nombre del usuario
 * @param {string} options.resetToken - Token de restablecimiento
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendPasswordResetEmail({ to, firstName, resetToken }) {
    // Asegurar que FRONTEND_URL es una URL absoluta con protocolo.
    // Si no está definida, usamos un fallback a localhost (puerto 5173 es común con Vite).
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Construir la URL de restablecimiento de contraseña
    const resetUrl = `${frontendUrl}/login/forgotPassword/${resetToken}`;


    const templateData = {
        EMAIL_BODY_CONTENT: `
            <h2>Hola ${firstName},</h2>
            <p>Has solicitado restablecer tu contraseña en Meraki Marketplace.</p>
            <p>Para continuar con el proceso, haz clic en el siguiente botón:</p>
        `,
        EMAIL_CTA_BUTTON: 'Restablecer Contraseña',
        EMAIL_CTA_URL: resetUrl
    };
    return sendEmail({
        to,
        subject: 'Restablecimiento de Contraseña - Meraki Marketplace',
        templateData
    });
}

module.exports = {
    sendEmail,
    sendPasswordResetEmail
};
