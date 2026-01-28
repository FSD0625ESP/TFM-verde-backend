// Brevo (anteriormente Sendinblue) es un servicio de email marketing y transaccional
// Se utiliza para enviar correos electrónicos desde nuestra aplicación
const brevo = require('@getbrevo/brevo');

// Handlebars es una biblioteca para renderizar plantillas de HTML
// Se utiliza para renderizar plantillas de HTML con variables dinámicas
const handlebars = require("handlebars");

// fs es una biblioteca para interactuar con el sistema de archivos
// Se utiliza para leer o escribir archivos en el sistema de archivos
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

// Configurar el cliente de Brevo
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
);

/**
 * Lee y compila una plantilla de email
 * @param {string} templateName - Nombre del archivo de la plantilla (sin extensión)
 * @returns {Promise<Function>} Plantilla compilada
 */
async function getEmailTemplate(templateName = "defaultTemplate") {
    const templatePath = path.join(
        __dirname,
        "..",
        "emails",
        `${templateName}.html`
    );
    const template = await fs.readFile(templatePath, "utf8");
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
async function sendEmail({
    to,
    subject,
    templateData,
    templateName = "defaultTemplate",
}) {
    try {
        // Obtener y compilar la plantilla
        const template = await getEmailTemplate(templateName);

        // Preparar los datos para la plantilla
        const emailData = {
            ...templateData,
            CURRENT_YEAR: new Date().getFullYear(),
            EMAIL_TITLE: subject,
            EMAIL_RECIPIENT: to,
        };

        // Generar el HTML del email
        const html = template(emailData);

        // Configurar el email para Brevo
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = {
            name: "Meraki Marketplace",
            email: process.env.EMAIL_USER || "noreply@meraki.com"
        };
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;

        // Enviar el email con Brevo
        const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
        return { success: true, messageId: response.messageId };
    } catch (error) {
        console.error("Error al enviar email con Brevo:", error);
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
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // Construir la URL de restablecimiento de contraseña
    const resetUrl = `${frontendUrl}/login/forgotPassword/${resetToken}`;

    const templateData = {
        EMAIL_BODY_CONTENT: `
            <h2>Hola ${firstName},</h2>
            <p>Has solicitado restablecer tu contraseña en Meraki Marketplace.</p>
            <p>Para continuar con el proceso, haz clic en el siguiente botón:</p>
        `,
        EMAIL_CTA_BUTTON: "Restablecer Contraseña",
        EMAIL_CTA_URL: resetUrl,
    };
    return sendEmail({
        to,
        subject: "Restablecimiento de Contraseña - Meraki Marketplace",
        templateData,
    });
}

const sendContactEmail = async ({ nombre, email, mensaje }) => {
    const templateData = {
        EMAIL_BODY_CONTENT: `
            <h2>Nuevo mensaje de contacto</h2>
            <p><strong>Nombre:</strong> ${nombre}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Mensaje:</strong> ${mensaje}</p>
        `,
    };
    return sendEmail({
        to: process.env.CONTACT_EMAIL || process.env.EMAIL_USER,
        subject: "Nuevo mensaje de contacto - Meraki Marketplace",
        templateData,
    });
};

/**
 * Envía un email usando una plantilla
 * @param {Object} options - Opciones del email
 * @param {string} options.to - Destinatario del email
 * @param {Object} options.firstName - Nombre del usuario
 * @param {string} options.storeName - Nombre de la tienda
 * @param {Object} options.itemsInfo - Información de los productos
 * @param {number} options.totalItems - Total de productos
 * @param {number} options.totalPrice - Total de la compra
 * @param {string} options.address - Dirección de entrega
 * @param {string} [options.templateName] - OPCIONAL - Nombre de la plantilla a usar (sin extensión)
 * @returns {Promise<Object>} Resultado del envío
 */
const sendOrderConfirmationEmail = async ({
    to,
    firstName,
    storeName,
    itemsInfo,
    totalItems,
    totalPrice,
    address,
}) => {
    const templateData = {
        EMAIL_BODY_CONTENT: `
            <h2>Muchas gracias por tu compra, ${firstName}</h2>
            <br />
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="padding-bottom:10px;">
                        <p style="margin:0;">Estos son los detalles de tu compra en <b>${storeName}</b>:</p>
                    </td>
                </tr>
            </table>
            <br />
            <table width="100%" cellpadding="2">
                <thead>
                    <tr>
                        <th width="65" align="left">Producto</th>
                        <th width="auto" align="left"></th>
                        <th width="55" align="center">Uds</th>
                        <th width="45" align="right">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsInfo
                .map(
                    (item) => `
                            <tr>
                                <td align="left"><img src="${item.productImage}" width="60" /></td> 
                                <td align="left">${item.productName}</td>
                                <td align="center">${item.quantity}</td>
                                <td align="right">${item.price}€</td>
                            </tr>
                        `
                )
                .join("")}
                </tbody>
                <tfoot>
                    <tr><td height="2" colspan="4" bgcolor="#000000" style="font-size:0; line-height:0;">&nbsp;</td></tr>
                    <tr height="50" valign="middle">
                        <td align="left" colspan="2"><b>Total:</b></td>
                        <td width="55" align="center"><b>${totalItems}</b></td>
                        <td width="45" align="right"><b>${totalPrice}€</b></td>
                    </tr>
                    <tr><td height="2" colspan="4" bgcolor="#000000" style="font-size:0; line-height:0;">&nbsp;</td></tr>
                </tfoot>
            </table>

            <br />
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="padding-bottom:10px;">
                        <p style="margin:0;">Fecha del pedido: ${new Date().toLocaleDateString()}</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding-bottom:10px;">
                        <p style="margin:0;">Dirección de entrega:</p>
                    </td>
                </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#CDF0DD">
                <tr>
                    <td style="padding: 10px;">
                    ${address.street}<br>
                    ${address.postalCode}<br>
                    ${address.city} (${address.state})<br>
                    ${address.country}<br>
                    </td>
                </tr>
            </table>

        `,
    };
    return sendEmail({
        to: to,
        subject: "Confirmación de Pedido - Meraki Marketplace",
        templateData,
    });
};

/**
 * Envía un email usando una plantilla
 * @param {Object} options - Opciones del email
 * @param {string} options.to - Destinatario del email
 * @param {Object} options.firstName - Nombre del usuario
 * @param {string} options.lastName - Apellido del usuario
 * @param {string} options.storeName - Nombre de la tienda
 * @param {Object} options.itemsInfo - Información de los productos
 * @param {number} options.totalItems - Total de productos
 * @param {number} options.totalPrice - Total de la compra
 * @param {string} options.address - Dirección de entrega
 * @param {string} [options.templateName] - OPCIONAL - Nombre de la plantilla a usar (sin extensión)
 * @returns {Promise<Object>} Resultado del envío
 */
const sendOrderNotificationToStoreEmail = async ({
    to,
    firstName,
    lastName,
    storeName,
    itemsInfo,
    totalItems,
    totalPrice,
    address,
}) => {
    const templateData = {
        EMAIL_BODY_CONTENT: `
            <h2>¡Nuevo pedido realizado en ${storeName}!</h2>
            <br />
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="padding-bottom:10px;">
                        <p style="margin:0;">Fecha de compra: ${new Date().toLocaleDateString()}</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding-bottom:10px;">
                        <p style="margin:0;">Estos son los detalles del pedido:</p>
                    </td>
                </tr>
            </table>
            <br />
            <table width="100%" cellpadding="2">
                <thead>
                    <tr>
                        <th width="65" align="left">Producto</th>
                        <th width="auto" align="left"></th>
                        <th width="55" align="center">Uds</th>
                        <th width="45" align="right">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsInfo
                .map(
                    (item) => `
                            <tr>
                                <td align="left"><img src="${item.productImage}" width="60" /></td> 
                                <td align="left">${item.productName}</td>
                                <td align="center">${item.quantity}</td>
                                <td align="right">${item.price}€</td>
                            </tr>
                        `
                )
                .join("")}
                </tbody>
                <tfoot>
                    <tr><td height="2" colspan="4" bgcolor="#000000" style="font-size:0; line-height:0;">&nbsp;</td></tr>
                    <tr height="50" valign="middle">
                        <td align="left" colspan="2"><b>Total:</b></td>
                        <td width="55" align="center"><b>${totalItems}</b></td>
                        <td width="45" align="right"><b>${totalPrice}€</b></td>
                    </tr>
                    <tr><td height="2" colspan="4" bgcolor="#000000" style="font-size:0; line-height:0;">&nbsp;</td></tr>
                </tfoot>
            </table>
            
            <br />
            <table width="100%" cellpadding="10" cellspacing="0" border="0" bgcolor="#CDF0DD">
                <tr>
                    <td style="padding-bottom: 10px;">
                    <h2>Datos del comprador</h2>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0px;">
                        Nombre: ${firstName} ${lastName}<br>
                        Teléfono de contacto: <a href="tel:${address.phoneNumber
            }"><font color="#26a69a">${address.phoneNumber
            }</font></a>
                    </td>
                </tr>                
                <tr>
                    <td style="padding-bottom:10px;">
                        <h2>Dirección de entrega:</h2>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0px;">
                    ${address.street}<br>
                    ${address.postalCode}<br>
                    ${address.city} (${address.state})<br>
                    ${address.country}<br>
                    </td>
                </tr>
            </table>

        `,
    };
    return sendEmail({
        to: to,
        subject: "Confirmación de Pedido - Meraki Marketplace",
        templateData,
    });
};

const sendStoreReportEmail = async ({ storeName, storeId, reason, description, reporterEmail, reporterName }) => {
    const templateData = {
        EMAIL_BODY_CONTENT: `
            <h2>Nuevo reporte de tienda</h2>
            <p>Se ha recibido un nuevo reporte para la tienda <strong>${storeName}</strong> (ID: ${storeId}).</p>
            <p><strong>Motivo del reporte:</strong> ${reason}</p>
            <p><strong>Descripción adicional:</strong> ${description || 'N/A'}</p>
            <p><strong>Reportado por:</strong> ${reporterName} (${reporterEmail})</p>
        `
    };
    return sendEmail({
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: 'Nuevo reporte de tienda - Meraki Marketplace',
        templateData
    });
};

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    sendContactEmail,
    sendStoreReportEmail,
    sendOrderConfirmationEmail,
    sendOrderNotificationToStoreEmail,
};
