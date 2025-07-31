
<!DOCTYPE html>
<html>
<head>
    <title>{{ $title }}</title>
    <style>
        /* Styles généraux */
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            color: #333333;
            margin: 40px;
            line-height: 1.6;
            font-size: 12pt;
        }

        /* En-tête */
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #1976D2;
            margin-bottom: 30px;
        }

        .header img {
            max-width: 150px;
            margin-bottom: 10px;
        }

        .header h1 {
            font-size: 24pt;
            color: #1976D2;
            margin: 0;
        }

        /* Informations sur le rapport */
        .report-info {
            margin-bottom: 20px;
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            font-size: 10pt;
        }

        .report-info p {
            margin: 5px 0;
        }

        /* Titres de section */
        h2 {
            font-size: 18pt;
            color: #1976D2;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 8px;
            margin-top: 30px;
            margin-bottom: 15px;
        }

        h3 {
            font-size: 14pt;
            color: #333333;
            margin-top: 20px;
            margin-bottom: 10px;
        }

        /* Tableaux */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        th, td {
            border: 1px solid #e0e0e0;
            padding: 10px;
            text-align: left;
            font-size: 10pt;
        }

        th {
            background-color: #1976D2;
            color: #ffffff;
            font-weight: bold;
        }

        tr:nth-child(even) {
            background-color: #f5f5f5;
        }

        /* Pied de page */
        .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 9pt;
            color: #777777;
            border-top: 1px solid #e0e0e0;
            padding-top: 10px;
            position: fixed;
            bottom: 20px;
            width: calc(100% - 80px);
        }

        /* Numérotation des pages */
        .page-number:after {
            content: "Page " counter(page);
        }

        /* Styles pour les montants */
        .currency {
            text-align: right;
        }
    </style>
</head>
<body>
<!-- En-tête -->
<div class="header">
    <img src="https://via.placeholder.com/150x50?text=Logo" alt="Logo">
    <h1>{{ $title }}</h1>
</div>

<!-- Informations sur le rapport -->
<div class="report-info">
    <p><strong>Généré le :</strong> {{ \Carbon\Carbon::now()->format('d/m/Y H:i') }}</p>
    @if($start && $end)
        <p><strong>Période :</strong> Du {{ $start->format('d/m/Y') }} au {{ $end->format('d/m/Y') }}</p>
    @else
        <p><strong>Période :</strong> Toutes les données disponibles</p>
    @endif
</div>

<!-- Fonction helper pour formater les statuts -->
@php
    function formatStatus($status, $type) {
        $rendezVousStatusMap = [
            'en_attente' => 'En attente',
            'confirme' => 'Confirmé',
            'annule' => 'Annulé',
            'termine' => 'Terminé'
        ];
        $paiementStatusMap = [
            'en_attente' => 'En attente',
            'paye' => 'Payé',
            'annule' => 'Annulé'
        ];
        return $type === 'rendezvous' ? ($rendezVousStatusMap[$status] ?? $status) : ($paiementStatusMap[$status] ?? $status);
    }
@endphp

    <!-- Rapport Général des Statistiques -->
@if($title == "Rapport Général des Statistiques")
    <h2>Statistiques Générales</h2>
    <table>
        <tr><th>Statistique</th><th>Valeur</th></tr>
        <tr><td>Total Utilisateurs</td><td>{{ $data['total_users'] ?? 0 }}</td></tr>
        <tr><td>Total Patients</td><td>{{ $data['total_patients'] ?? 0 }}</td></tr>
        <tr><td>Total Médecins</td><td>{{ $data['total_medecins'] ?? 0 }}</td></tr>
        <tr><td>Total Rendez-vous</td><td>{{ $data['total_rendez_vous'] ?? 0 }}</td></tr>
        <tr><td>Total Chiffre d'affaires</td><td class="currency">{{ number_format($data['total_revenue'] ?? 0, 2, ',', ' ') }} F CFA</td></tr>
        <tr><td>Total Paiements</td><td>{{ $data['total_paiements'] ?? 0 }}</td></tr>
    </table>

    <h3>Utilisateurs par Rôle</h3>
    <table>
        <tr><th>Rôle</th><th>Total</th></tr>
        @foreach($data['users_by_role'] ?? [] as $role => $count)
            <tr><td>{{ ucfirst($role) }}</td><td>{{ $count }}</td></tr>
        @endforeach
    </table>

    <h3>Patients par Tranche d'âge</h3>
    <table>
        <tr><th>Tranche d'âge</th><th>Total</th></tr>
        @foreach($data['patients_by_age_group'] ?? [] as $item)
            <tr><td>{{ $item['age_group'] }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Rendez-vous par Statut</h3>
    <table>
        <tr><th>Statut</th><th>Total</th></tr>
        @foreach($data['rendez_vous_by_status'] ?? [] as $item)
            <tr><td>{{ formatStatus($item['statut'], 'rendezvous') }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Paiements par Statut</h3>
    <table>
        <tr><th>Statut</th><th>Total</th><th>Montant Total</th></tr>
        @foreach($data['paiements_by_status'] ?? [] as $item)
            <tr><td>{{ formatStatus($item['statut'], 'paiements') }}</td><td>{{ $item['total'] }}</td><td class="currency">{{ number_format($item['total_amount'] ?? 0, 2, ',', ' ') }} F CFA</td></tr>
        @endforeach
    </table>

    <!-- Rapport Statistique des Patients -->
@elseif($title == "Rapport Statistique des Patients")
    <h2>Statistiques des Patients</h2>
    <p><strong>Nouveaux Patients dans la période :</strong> {{ $data['new_patients'] ?? 0 }}</p>

    <h3>Patients par Sexe</h3>
    <table>
        <tr><th>Sexe</th><th>Total</th></tr>
        @foreach($data['patients_by_gender'] ?? [] as $item)
            <tr><td>{{ ucfirst($item['sexe']) }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Patients par Tranche d'âge</h3>
    <table>
        <tr><th>Tranche d'âge</th><th>Total</th></tr>
        @foreach($data['patients_by_age_group'] ?? [] as $item)
            <tr><td>{{ $item['age_group'] }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Top 10 Patients par Rendez-vous</h3>
    <table>
        <tr><th>Nom du Patient</th><th>Total Rendez-vous</th></tr>
        @foreach($data['top_patients_by_appointments'] ?? [] as $item)
            <tr><td>{{ $item['patient_name'] }}</td><td>{{ $item['total_appointments'] }}</td></tr>
        @endforeach
    </table>

    <!-- Rapport Statistique des Médecins -->
@elseif($title == "Rapport Statistique des Médecins")
    <h2>Statistiques des Médecins</h2>
    <h3>Médecins par Spécialité</h3>
    <table>
        <tr><th>Spécialité</th><th>Total</th></tr>
        @foreach($data['medecins_by_speciality'] ?? [] as $item)
            <tr><td>{{ $item['specialite'] }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Rendez-vous par Médecin</h3>
    <table>
        <tr><th>Nom du Médecin</th><th>Spécialité</th><th>Total Rendez-vous</th></tr>
        @foreach($data['appointments_per_medecin'] ?? [] as $item)
            <tr><td>{{ $item['medecin_name'] }}</td><td>{{ $item['specialite'] }}</td><td>{{ $item['total_appointments'] }}</td></tr>
        @endforeach
    </table>

    <h3>Revenus par Médecin</h3>
    <table>
        <tr><th>Nom du Médecin</th><th>Total Revenu</th></tr>
        @foreach($data['revenue_per_medecin'] ?? [] as $item)
            <tr><td>{{ $item['medecin_name'] }}</td><td class="currency">{{ number_format($item['total_revenue'], 2, ',', ' ') }} F CFA</td></tr>
        @endforeach
    </table>

    <!-- Rapport Statistique des Rendez-vous -->
@elseif($title == "Rapport Statistique des Rendez-vous")
    <h2>Statistiques des Rendez-vous</h2>
    <p><strong>Total Rendez-vous dans la période :</strong> {{ $data['total_rendez_vous'] ?? 0 }}</p>

    <h3>Rendez-vous par Statut</h3>
    <table>
        <tr><th>Statut</th><th>Total</th></tr>
        @foreach($data['rendez_vous_by_status'] ?? [] as $item)
            <tr><td>{{ formatStatus($item['statut'], 'rendezvous') }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Rendez-vous par Motif</h3>
    <table>
        <tr><th>Motif</th><th>Total</th></tr>
        @foreach($data['rendez_vous_by_motif'] ?? [] as $item)
            <tr><td>{{ $item['motif'] }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Raisons d'Annulation/Report</h3>
    <table>
        <tr><th>Raison de Report</th><th>Raison Générale</th><th>Total</th></tr>
        @foreach($data['cancelled_reasons'] ?? [] as $item)
            <tr><td>{{ $item['reschedule_reason'] ?? 'N/A' }}</td><td>{{ $item['reason'] ?? 'N/A' }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <h3>Rendez-vous Quotidiens</h3>
    <table>
        <tr><th>Date</th><th>Total</th></tr>
        @foreach($data['rendez_vous_daily'] ?? [] as $item)
            <tr><td>{{ $item['date'] }}</td><td>{{ $item['total'] }}</td></tr>
        @endforeach
    </table>

    <!-- Rapport Statistique des Paiements -->
@elseif($title == "Rapport Statistique des Paiements")
    <h2>Statistiques des Paiements</h2>
    <p><strong>Total Paiements dans la période :</strong> {{ $data['total_paiements'] ?? 0 }}</p>
    <p><strong>Total Revenu dans la période :</strong> {{ number_format($data['total_revenue'] ?? 0, 2, ',', ' ') }} F CFA</p>
    <p><strong>Paiement Moyen :</strong> {{ number_format($data['average_payment'] ?? 0, 2, ',', ' ') }} F CFA</p>

    <h3>Paiements par Statut</h3>
    <table>
        <tr><th>Statut</th><th>Total</th><th>Montant Total</th></tr>
        @foreach($data['paiements_by_status'] ?? [] as $item)
            <tr><td>{{ formatStatus($item['statut'], 'paiements') }}</td><td>{{ $item['total'] }}</td><td class="currency">{{ number_format($item['total_amount'], 2, ',', ' ') }} F CFA</td></tr>
        @endforeach
    </table>

    <h3>Revenu Mensuel</h3>
    <table>
        <tr><th>Mois</th><th>Revenu</th></tr>
        @foreach($data['paiements_monthly_revenue'] ?? [] as $item)
            <tr><td>{{ $item['month'] }}</td><td class="currency">{{ number_format($item['total_monthly_revenue'], 2, ',', ' ') }} F CFA</td></tr>
        @endforeach
    </table>
@endif

<!-- Pied de page -->
<div class="footer">
    <p>Application de prise de rendez-vous - Rapports Statistiques</p>
    <p class="page-number"></p>
</div>
</body>
</html>
