import type { APIRoute } from "astro";
import { supabaseAdmin } from "src/utils/supabase";
import { crearSesion } from "src/pages/api/sesiones/sesiones";
import { email } from "astro:schema";
import { enviarEmailApi } from "src/utils/envioEmails";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const data = await request.json();

        const {
            email,
            contrasena
        } = data;

        // -------------------------
        // 🔒 VALIDACIONES BÁSICAS
        // -------------------------

        const bloqueo = cookies.get("bloqueo_email")?.value;

        if (bloqueo === "bloqueo_email_habilitado") {
            return new Response(
                JSON.stringify({
                    mensaje: "Has sol·licitat recentment un correu. Torna-ho a intentar d'aquí a uns minuts."
                }),
                { status: 429 } // Too Many Requests
            );
        }

        if (!email) {
            return new Response(
                JSON.stringify({
                    mensaje: "Falten camps obligatoris."
                }),
                { status: 400 }
            );
        }
        

        // -------------------------
        // 👤 EJEMPLO: USUARIO EXISTE
        // (aquí conectarías Supabase o BD)
        // -------------------------

        const {data:usuarioExistente,  error } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("email", email)
            .single();


        //const usuarioExistente = false; // simulado

        if (!usuarioExistente) {
            return new Response(
                JSON.stringify({
                    mensaje: "No s'ha trobat cap usuari amb aquest correu electrònic."
                }),
                { status: 409 }
            );
        }

        const token_recuperacion = crypto.randomUUID();

        console.log("Token de recuperación generado:", token_recuperacion);


        const { data: nuevoVerificacion, error: crearVerificacionError } = await supabaseAdmin
            .from("verificaciones")
            .insert({
                id_usuario: usuarioExistente.id,
                token: token_recuperacion,
                fecha_expiracion: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
                fecha_creacion: new Date().toISOString(),
                usado: false,
                tipo: "RECUPERACION_EMAIL"
            })
            .select()
            .single();

        if (crearVerificacionError) {
            return new Response(
                JSON.stringify({
                    mensaje: "Error al generar el token de recuperación."
                }),
                { status: 500 }
            );
        }

        try {
          await enviarEmailApi({
            to: email,
            subject: "Sol·licitud de recuperació de contrasenya | Esports IES Calvià",
            html: htmlEmail(token_recuperacion, email),
            origen: "esports_iescalvia"
          });
        
        } catch (EmailError) {
          console.error("Error enviando email:", EmailError);
        }

        // -------------------------
        // 🔐 Token bloqueo emails
        // -------------------------
        cookies.set("bloqueo_email", "bloqueo_email_habilitado", {
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            expires: new Date(Date.now() + 15 * 60 * 1000), // 5 minutos
        });
        
        // -------------------------
        // ✅ RESPUESTA OK
        // -------------------------

        return new Response(
            JSON.stringify({
                mensaje: "Usuari registrat correctament.",
                usuario: usuarioExistente
            }),
            { status: 200 }
        );

    } catch (error) {
        console.error(error);

        return new Response(
            JSON.stringify({
                mensaje: "Error intern del servidor."
            }),
            { status: 500 }
        );
    }
};

const htmlEmail = (token_recuperacion: string, email: string) => {
    const urlRecuperacion = `http://localhost:4321/recupera-contrasena?token=${token_recuperacion}`;
    const urlWebsite = `http://esports.iescalvia.vercel.app`;
    

    return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/1999/xhtml" lang="ca">
 <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <title>Copia de (1) Nuevo mensaje 2</title><!--[if (mso 16)]>
      <style type="text/css">
         a {text-decoration: none;}
      </style>
      <![endif]--><!--[if gte mso 9]>
      <style>sup { font-size: 100% !important; }</style>
      <![endif]--><!--[if gte mso 9]>
      <noscript>
         <xml>
           <o:OfficeDocumentSettings>
           <o:AllowPNG></o:AllowPNG>
           <o:PixelsPerInch>96</o:PixelsPerInch>
           </o:OfficeDocumentSettings>
         </xml>
      </noscript>
      <![endif]--><!--[if mso]><xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
      <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
    </xml><![endif]-->
  <style type="text/css">.rollover:hover .rollover-first {
  max-height:0px!important;
  display:none!important;
}
.rollover:hover .rollover-second {
  max-height:none!important;
  display:block!important;
}
.rollover span {
  font-size:0px;
}
u + .body img ~ div div {
  display:none;
}
#outlook a {
  padding:0;
}
span.MsoHyperlink,
span.MsoHyperlinkFollowed {
  color:inherit;
  mso-style-priority:99;
}
a.es-button {
  mso-style-priority:100!important;
  text-decoration:none!important;
}
a[x-apple-data-detectors],
#MessageViewBody a {
  color:inherit!important;
  text-decoration:none!important;
  font-size:inherit!important;
  font-family:inherit!important;
  font-weight:inherit!important;
  line-height:inherit!important;
}
.es-desk-hidden {
  display:none;
  float:left;
  overflow:hidden;
  width:0;
  max-height:0;
  line-height:0;
  mso-hide:all;
}
@media only screen and (max-width:600px) {.es-p-default { } *[class="gmail-fix"] { display:none!important } p, a { line-height:150%!important } h1, h1 a { line-height:120%!important } h2, h2 a { line-height:120%!important } h3, h3 a { line-height:120%!important } h4, h4 a { line-height:120%!important } h5, h5 a { line-height:120%!important } h6, h6 a { line-height:120%!important } h1 { font-size:40px!important; text-align:left } h2 { font-size:32px!important; text-align:left } h3 { font-size:28px!important; text-align:left } h4 { font-size:24px!important; text-align:left } h5 { font-size:20px!important; text-align:left } h6 { font-size:16px!important; text-align:left } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:40px!important } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:32px!important } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:28px!important } .es-header-body h4 a, .es-content-body h4 a, .es-footer-body h4 a { font-size:24px!important } .es-header-body h5 a, .es-content-body h5 a, .es-footer-body h5 a { font-size:20px!important } .es-header-body h6 a, .es-content-body h6 a, .es-footer-body h6 a { font-size:16px!important } .es-header-body p, .es-header-body a { font-size:14px!important } .es-content-body p, .es-content-body a { font-size:14px!important } .es-footer-body p, .es-footer-body a { font-size:14px!important } .es-infoblock p, .es-infoblock a { font-size:12px!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3, .es-m-txt-c h4, .es-m-txt-c h5, .es-m-txt-c h6 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3, .es-m-txt-r h4, .es-m-txt-r h5, .es-m-txt-r h6 { text-align:right!important } .es-m-txt-j, .es-m-txt-j h1, .es-m-txt-j h2, .es-m-txt-j h3, .es-m-txt-j h4, .es-m-txt-j h5, .es-m-txt-j h6 { text-align:justify!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3, .es-m-txt-l h4, .es-m-txt-l h5, .es-m-txt-l h6 { text-align:left!important } .es-m-txt-r img, .es-m-txt-c img, .es-m-txt-l img { display:inline!important } .es-m-txt-r .rollover:hover .rollover-second, .es-m-txt-c .rollover:hover .rollover-second, .es-m-txt-l .rollover:hover .rollover-second { display:inline!important } .es-m-txt-r .rollover span, .es-m-txt-c .rollover span, .es-m-txt-l .rollover span { line-height:0!important; font-size:0!important; display:block } .es-m-txt-r .es-menu td { float:right!important } .es-m-txt-l .es-menu td { float:left!important } .es-m-txt-c .es-menu td { display:inline-block } .es-spacer { display:inline-table } a.es-button, button.es-button { display:inline-block!important; font-size:14px!important; padding:10px 20px 10px 20px!important; line-height:120%!important } .es-button-border { display:inline-block!important } .es-m-fw, .es-m-fw.es-fw, .es-m-fw .es-button { display:block!important } .es-m-il, .es-m-il .es-button, .es-social, .es-social td, .es-menu.es-table-not-adapt { display:inline-block!important } .es-adaptive table, .es-left, .es-right { width:100%!important; border-collapse:separate!important } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .adapt-img { width:100%!important; height:auto!important } .es-adapt-td { display:block!important; width:100%!important } .es-mobile-hidden, .es-hidden { display:none!important } .es-container-hidden { display:none!important } .es-desk-hidden { width:auto!important; overflow:visible!important; float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-hidden { display:table-cell!important } td.es-desk-menu-hidden { display:table-cell!important } .es-m-txt-c .es-menu td.es-desk-menu-hidden { display:inline-block!important } .es-menu td { width:1%!important } table.es-table-not-adapt, .esd-block-html table, .es-m-txt-r .es-menu td, .es-m-txt-l .es-menu td, .es-m-txt-c .es-menu td { width:auto!important } .h-auto { height:auto!important } .es-m-text .es-text-mobile-size-28, .es-m-text .es-text-mobile-size-28 * { font-size:28px!important } .es-m-text .es-text-mobile-size-10, .es-m-text .es-text-mobile-size-10 * { font-size:10px!important } }
@media screen and (max-width:384px) {.mail-message-content { width:414px!important } }</style>
 </head>
 <body class="body" style="width:100%;height:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
  <div dir="ltr" class="es-wrapper-color" lang="ca" style="background-color:#EFEFEF"><!--[if gte mso 9]>
 <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
   <v:fill type="tile"  color="#efefef" ></v:fill>
 </v:background>
<![endif]-->
   <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%">
    <tbody>
     <tr>
      <td valign="top" style="padding:0;Margin:0">
       <table cellspacing="0" cellpadding="0" align="center" class="es-footer" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important;background-color:transparent">
        <tbody>
         <tr>
          <td align="center" style="padding:0;Margin:0">
           <table cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" class="es-footer-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:#FFFFFF;width:600px">
            <tbody>
             <tr>
              <td align="left" bgcolor="#121318" style="Margin:0;padding:20px;background-color:#121318">
               <table cellspacing="0" cellpadding="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                <tbody>
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                    <tbody>
                     <tr>
                      <td align="left" style="padding:0;Margin:0" class="es-m-text"><h1 style="Margin:0;font-family:arial, 'helvetica neue', helvetica, sans-serif;mso-line-height-rule:exactly;letter-spacing:0;font-size:40px;font-style:normal;font-weight:normal;line-height:48px;color:#ffffff;text-align:center">Recuperació de contrasenya</h1>
                       <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;margin:12px auto 0">
                        <tbody>
                         <tr>
                          <td style="padding:0;Margin:0;font-size:0;line-height:0;width:64px;height:4px;background-color:#b2c5ff;border-radius:999px;color:#ffffff">&nbsp;</td>
                         </tr>
                        </tbody>
                       </table></td>
                     </tr>
                    </tbody>
                   </table></td>
                 </tr>
                </tbody>
               </table></td>
             </tr>
             <tr>
              <td align="left" bgcolor="#121318" style="padding:20px 20px 0;Margin:0;background-color:#121318">
               <table cellspacing="0" width="100%" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                <tbody>
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                    <tbody>
                     <tr>
                      <td align="left" style="padding:0;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#ffffff;font-size:14px">Hem rebut una sol·licitud per restablir la teva contrasenya.&nbsp;</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#ffffff;font-size:14px"><br></p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#ffffff;font-size:14px">L’enllaç serà vàlid durant 15 minuts.</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#ffffff;font-size:14px"><br></p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#ffffff;font-size:14px">Si has sigut tu, pots crear una nova contrasenya fent clic al botó de sota. Si no has sol·licitat aquest canvi, pots ignorar aquest correu.</p></td>
                     </tr>
                    </tbody>
                   </table></td>
                 </tr>
                </tbody>
               </table></td>
             </tr>
             <tr>
              <td align="left" bgcolor="#121318" style="padding:20px;Margin:0;background-color:#121318">
               <table width="100%" cellpadding="0" cellspacing="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                <tbody>
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table cellspacing="0" role="presentation" width="100%" cellpadding="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                    <tbody>
                     <tr>
                      <td align="center" style="padding:0;Margin:0"><a href=${urlRecuperacion} target="_blank" class="es-button" style="mso-style-priority:100 !important;text-decoration:none;mso-line-height-rule:exactly;color:white;font-size:14px;font-weight:bold;padding:14px;display:block;background:#31CB4B;border-radius:8px;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-style:normal;line-height:17px;width:100%;text-align:center;letter-spacing:1px;mso-padding-alt:0;mso-border-alt:10px solid #31CB4B;background-color:#0f766e;max-width:85%">RESTABLIR CONTRASENYA</a></td>
                     </tr>
                    </tbody>
                   </table></td>
                 </tr>
                </tbody>
               </table></td>
             </tr>
             <tr>
              <td align="left" bgcolor="#121318" style="padding:20px 20px 0;Margin:0;background-color:#121318">
               <table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                <tbody>
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                    <tbody>
                     <tr>
                      <td align="center" style="padding:0;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#666666;font-size:14px">©2026 Esports IES Calvià | Tots els drets reservats.</p></td>
                     </tr>
                    </tbody>
                   </table></td>
                 </tr>
                </tbody>
               </table></td>
             </tr>
            </tbody>
           </table></td>
         </tr>
        </tbody>
       </table>
       <table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important">
        <tbody>
         <tr>
          <td align="center" style="padding:0;Margin:0">
           <table bgcolor="#121318" align="center" cellpadding="0" cellspacing="0" class="es-content-body" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:#121318;width:600px" role="none">
            <tbody>
             <tr>
              <td align="left" style="padding:10px 20px 0;Margin:0">
               <table cellspacing="0" width="100%" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                <tbody>
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                    <tbody>
                     <tr>
                      <td align="left" class="es-m-text" style="padding:0 30px;Margin:0"><p class="es-text-mobile-size-10" style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:18px;letter-spacing:0;color:#575757;font-size:12px;text-align:center">Heu rebut aquest correu perquè us heu registrat a la nostra web&nbsp;<a href="${urlWebsite}" target="_blank" style="mso-line-height-rule:exactly;text-decoration:underline;color:#575757;font-size:12px;font-weight:inherit">esports.iescalvia.com</a>&nbsp;utilitzant el compte de correu&nbsp;<i>${email}</i>.</p></td>
                     </tr>
                    </tbody>
                   </table></td>
                 </tr>
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table cellspacing="0" role="presentation" width="100%" cellpadding="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                    <tbody>
                     <tr>
                      <td align="left" class="es-m-text" style="padding:0 30px 10px;Margin:0"><p class="es-text-mobile-size-10" style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:18px;letter-spacing:0;color:#575757;font-size:12px;text-align:center">Per a més informació sobre com tractem les vostres dades, podeu consultar el nostre</p><p class="es-text-mobile-size-10" style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:18px;letter-spacing:0;color:#575757;font-size:12px;text-align:center">​<a href="${urlWebsite}/aviso-legal" target="_blank" style="mso-line-height-rule:exactly;text-decoration:underline;color:#575757;font-size:12px;font-weight:inherit">Avís Legal</a>.</p></td>
                     </tr>
                    </tbody>
                   </table></td>
                 </tr>
                </tbody>
               </table></td>
             </tr>
            </tbody>
           </table></td>
         </tr>
        </tbody>
       </table></td>
     </tr>
    </tbody>
   </table>
  </div>
 </body>
</html>
    `;
}