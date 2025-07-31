<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facture {{ $facture->numero }}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
        }

        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 24px;
        }

        .header p {
            margin: 5px 0;
            color: #666;
        }

        .facture-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }

        .facture-info div {
            width: 48%;
        }

        .facture-details {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }

        .facture-details h3 {
            margin-top: 0;
            color: #007bff;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 8px;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .info-row strong {
            color: #495057;
        }

        .consultation-details {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 5px;
        }

        .montant-section {
            text-align: right;
            margin-top: 30px;
            padding: 15px;
            background-color: #e9ecef;
            border-radius: 5px;
        }

        .montant-total {
            font-size: 18px;
            font-weight: bold;
            color: #007bff;
            border-top: 2px solid #007bff;
            padding-top: 10px;
            margin-top: 10px;
        }

        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
            padding-top: 15px;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .status-payee {
            background-color: #d4edda;
            color: #155724;
        }

        .status-envoyee {
            background-color: #d1ecf1;
            color: #0c5460;
        }

        .status-brouillon {
            background-color: #f8d7da;
            color: #721c24;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }

        th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }

        @media print {
            body {
                margin: 0;
                padding: 15px;
            }
        }
    </style>
</head>
<body>
<div class="header">
    <h1>CLINIQUE TOUNKARA</h1>
    <p>Keur Massar, Dakar, Sénégal</p>
    <p>Téléphone: +221 123 456 789 | Email: contact@clinique.sn</p>
</div>

<div class="facture-info">
    <div>
        <h3>Informations Patient</h3>
        @if(isset($patient) && $patient)
            <p><strong>Nom:</strong> {{ $patient->user->nom ?? 'N/A' }} {{ $patient->user->prenom ?? '' }}</p>
            <p><strong>Email:</strong> {{ $patient->user->email ?? 'N/A' }}</p>
            <p><strong>Téléphone:</strong> {{ $patient->user->telephone ?? 'N/A' }}</p>
            <p><strong>Adresse:</strong> {{ $patient->user->adresse ?? 'N/A' }}</p>
        @else
            <p>Informations patient non disponibles</p>
        @endif
    </div>

    <div>
        <h3>Informations Facture</h3>
        <p><strong>Numéro:</strong> {{ $facture->numero }}</p>
        <p><strong>Date d'émission:</strong> {{ \Carbon\Carbon::parse($facture->date_emission)->format('d/m/Y') }}</p>
        <p><strong>Date d'échéance:</strong> {{ \Carbon\Carbon::parse($facture->date_echeance)->format('d/m/Y') }}</p>
        <p><strong>Statut:</strong>
            <span class="status-badge status-{{ $facture->statut }}">
                    {{ ucfirst($facture->statut) }}
                </span>
        </p>
    </div>
</div>

<div class="consultation-details">
    <h3>Détails de la Consultation</h3>

    @if(isset($medecin) && $medecin)
        <div class="info-row">
            <span><strong>Médecin:</strong></span>
            <span>Dr. {{ $medecin->user->nom ?? 'N/A' }} {{ $medecin->user->prenom ?? '' }}</span>
        </div>
        <div class="info-row">
            <span><strong>Spécialité:</strong></span>
            <span>{{ $medecin->specialite ?? 'N/A' }}</span>
        </div>
    @endif

    @if(isset($rendezVous) && $rendezVous)
        <div class="info-row">
            <span><strong>Date du rendez-vous:</strong></span>
            <span>{{ \Carbon\Carbon::parse($rendezVous->date_heure)->format('d/m/Y à H:i') }}</span>
        </div>
        <div class="info-row">
            <span><strong>Motif:</strong></span>
            <span>{{ $rendezVous->motif ?? 'Consultation générale' }}</span>
        </div>
    @endif

    @if(isset($paiement) && $paiement)
        <div class="info-row">
            <span><strong>Référence paiement:</strong></span>
            <span>{{ $paiement->reference ?? $paiement->paydunya_token }}</span>
        </div>
        <div class="info-row">
            <span><strong>Statut paiement:</strong></span>
            <span>{{ ucfirst($paiement->statut) }}</span>
        </div>
    @endif
</div>

<table>
    <thead>
    <tr>
        <th>Description</th>
        <th>Quantité</th>
        <th>Prix unitaire</th>
        <th>Total</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td>
            Consultation médicale
            @if(isset($medecin) && $medecin)
                <br><small>avec Dr. {{ $medecin->user->nom ?? '' }} {{ $medecin->user->prenom ?? '' }}</small>
            @endif
        </td>
        <td>1</td>
        <td>{{ number_format($facture->montant_total, 0, ',', ' ') }} FCFA</td>
        <td>{{ number_format($facture->montant_total, 0, ',', ' ') }} FCFA</td>
    </tr>
    </tbody>
</table>

<div class="montant-section">
    <div class="info-row">
        <span><strong>Sous-total:</strong></span>
        <span>{{ number_format($facture->montant_total, 0, ',', ' ') }} FCFA</span>
    </div>

    @if($facture->tva > 0)
        <div class="info-row">
            <span><strong>TVA:</strong></span>
            <span>{{ number_format($facture->tva, 0, ',', ' ') }} FCFA</span>
        </div>
    @endif

    <div class="montant-total">
        <strong>TOTAL: {{ number_format($facture->montant_total + ($facture->tva ?? 0), 0, ',', ' ') }} FCFA</strong>
    </div>
</div>

<div class="footer">
    <p>Cette facture a été générée électroniquement le {{ now()->format('d/m/Y à H:i') }}</p>
    <p>Merci de votre confiance | Clinique Médicale - Votre santé, notre priorité</p>

    @if(isset($details) && is_array($details))
        <p><small>ID Transaction: {{ $details['paydunya_token'] ?? 'N/A' }}</small></p>
    @endif
</div>
</body>
</html>
