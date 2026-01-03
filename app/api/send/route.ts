import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, nome, protocolo, placa } = await req.json();

    const data = await resend.emails.send({
      from: 'Rivilog <onboarding@resend.dev>',
      to: [email],
      subject: `Comprovante Recebido: Protocolo ${protocolo} - Rivilog`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <div style="background-color: #1e3a8a; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-style: italic; font-weight: 800; letter-spacing: -1px;">
                RIVI<span style="color: #3b82f6;">LOG</span>
              </h1>
            </div>

            <div style="padding: 40px 30px;">
              <h2 style="color: #111827; margin-top: 0; font-size: 20px;">Olá, ${nome}.</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                Confirmamos que o seu envio de comprovante foi processado e registrado com sucesso em nossa base de dados logística.
              </p>

              <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #6b7280; font-weight: bold; letter-spacing: 0.05em;">Detalhes do Registro</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Protocolo:</strong> <span style="font-family: monospace; color: #1e3a8a; font-size: 18px;">${protocolo}</span></p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Placa:</strong> ${placa.toUpperCase()}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">
                Este número de protocolo é a sua garantia. Caso precise de suporte ou revisão deste lançamento, tenha-o em mãos.
              </p>

              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

              <p style="text-align: center; font-size: 12px; color: #9ca3af; margin: 0;">
                Rivilog Logística e Transportes<br />
                Este é um e-mail automático, por favor não responda.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}