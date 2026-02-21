Desenvolvimento:

Frontend:

HTML, CSS, JavaScript (puro ou com framework)
Responsivo: Celulares, Tablets, (paisagen e retrato), notebook

Backend:

Não precisa de um servidor complexo. Mas precisa de:

Autenticação do admin → Firebase Auth
CRUD de carros → Firestore SDK (usado diretamente no frontend admin)
Upload de imagens → Firebase Storage

Banco de Dados:

Paginas:

- Landing page -> index.html(homepage)

- carros -> Uma pagina mais com mais informações técnicas como:
Marca, modelo, ano
Quilometragem
Combustível
Câmbio
Condição (original, restaurado, projeto etc.)
Observações (ex: “motor original”, “documentação OK”)

Fotos grandes (e em alta resolução)

Botão grande e fixo no rodapé:
“Negociar via WhatsApp” → abre chat direto com mensagem pré-preenchida contendo o modelo do carro.
Sem carrinho/sistema de pagamento


Cuidados Críticos
Nunca exponha chaves secretas no frontend. Use apenas as chaves públicas do Firebase (apiKey, projectId etc.).
Proteja o Firestore com regras de segurança — senão qualquer um pode apagar os carros.
Otimiza imagens: redimensione para 800px de largura e converta para WebP.
Teste o fluxo completo:
Acessar site → ver carro → clicar WhatsApp → mensagem pré-preenchida
Logar no admin → postar carro → aparecer no site