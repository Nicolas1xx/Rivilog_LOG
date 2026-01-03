import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Esta rota vai rodar no servidor (Node.js environment)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Extraindo dados do formulário
    const file = formData.get('file') as File;
    const nome = formData.get('nome') as string;
    const dataViagem = formData.get('data') as string;
    const placa = formData.get('placa') as string;
    const operacao = formData.get('operacao') as string;
    const valor = formData.get('valor') as string;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 });
    }

    // 1. Upload da Imagem para o Supabase Storage
    // Gera um nome único para o arquivo: timestamp-placa.extensao
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${placa}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('comprovantes') // Certifique-se de criar esse bucket no painel do Supabase
      .upload(filePath, file);

    if (uploadError) {
      console.error('Erro upload:', uploadError);
      throw new Error('Falha ao salvar a imagem');
    }

    // 2. Pegar a URL pública da imagem
    const { data: publicUrlData } = supabase.storage
      .from('comprovantes')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // 3. Salvar os dados no Banco de Dados (Tabela 'pedagios')
    const { error: dbError } = await supabase
      .from('pedagios') // Certifique-se de criar essa tabela no SQL Editor
      .insert([
        {
          nome_motorista: nome,
          data_viagem: dataViagem,
          placa: placa,
          operacao: operacao,
          valor: parseFloat(valor),
          url_comprovante: publicUrl,
        },
      ]);

    if (dbError) {
      console.error('Erro banco:', dbError);
      throw new Error('Falha ao salvar no banco de dados');
    }

    // Aqui futuramente entra a lógica do ExcelJS e Nodemailer
    // Por enquanto, retornamos sucesso para garantir que o básico funciona.

    return NextResponse.json({ success: true, message: 'Cadastrado com sucesso!' });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}