<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paiement Réussi</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        .success-icon {
            color: #28a745;
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        .title {
            color: #28a745;
            margin-bottom: 1rem;
        }
        .info {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
        }
        .btn {
            background: #007bff;
            color: white;
            padding: 0.75rem 1.5rem;
            text-decoration: none;
            border-radius: 4px;
            display: inline-block;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="success-icon">✓</div>
    <h1 class="title">Paiement Réussi !</h1>
    <p>Votre paiement a été traité avec succès.</p>

    @if(request('token'))
        <div class="info">
            <strong>Token de transaction :</strong><br>
            {{ request('token') }}
        </div>
    @endif

    @if(request('paiement_id'))
        <div class="info">
            <strong>ID du paiement :</strong><br>
            {{ request('paiement_id') }}
        </div>
    @endif

    <p>Une facture a été générée et vous devriez recevoir une confirmation par email.</p>

    <a href="{{ config('app.frontend_url', 'http://localhost:4200') }}" class="btn">
        Retour à l'application
    </a>
</div>

<script>
    // Optionnel : redirection automatique après 10 secondes
    setTimeout(function() {
        window.location.href = "{{ config('app.frontend_url', 'http://localhost:4200') }}";
    }, 10000);
</script>
</body>
</html>
