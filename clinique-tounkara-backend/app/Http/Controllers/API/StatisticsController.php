<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Patient;
use App\Models\Medecin;
use App\Models\RendezVous;
use App\Models\Paiement;
use App\Models\Rapport;
use App\Models\Administrateur;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Barryvdh\DomPDF\Facade\Pdf;

class StatisticsController extends Controller
{
    /**
     * Calcule et retourne une date de début basée sur la période et la date de fin.
     * @param string $period
     * @param string|null $startDate
     * @param string|null $endDate
     * @return array [Carbon $start, Carbon $end]
     */
    protected function getDateRange(Request $request)
    {
        $period = $request->input('period', 'all_time');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        $end = $endDate ? Carbon::parse($endDate)->endOfDay() : Carbon::now()->endOfDay();
        $start = null;

        switch ($period) {
            case 'today':
                $start = Carbon::now()->startOfDay();
                break;
            case 'this_week':
                $start = Carbon::now()->startOfWeek();
                break;
            case 'this_month':
                $start = Carbon::now()->startOfMonth();
                break;
            case 'this_year':
                $start = Carbon::now()->startOfYear();
                break;
            case 'last_7_days':
                $start = Carbon::now()->subDays(6)->startOfDay();
                break;
            case 'last_30_days':
                $start = Carbon::now()->subDays(29)->startOfDay();
                break;
            case 'custom':
                $start = $startDate ? Carbon::parse($startDate)->startOfDay() : Carbon::now()->startOfDay();
                break;
            case 'all_time':
            default:
                break;
        }

        if ($start === null && $period !== 'all_time') {
            $start = Carbon::now()->subYears(100)->startOfDay();
        }

        return [$start, $end];
    }

    /**
     * Récupère les statistiques générales.
     */
    public function getGeneralStatistics(Request $request)
    {
        list($start, $end) = $this->getDateRange($request);

        $queryPatients = Patient::query();
        $queryMedecins = Medecin::query();
        $queryRendezVous = RendezVous::query();
        $queryPaiements = Paiement::query();

        if ($start) {
            $queryPatients->whereBetween('created_at', [$start, $end]);
            $queryMedecins->whereBetween('created_at', [$start, $end]);
            $queryRendezVous->whereBetween('date_heure', [$start, $end]);
            $queryPaiements->whereBetween('date', [$start, $end]);
        }

        $totalUsers = User::count();
        $totalPatients = $queryPatients->count();
        $totalMedecins = $queryMedecins->count();
        $totalRendezVous = $queryRendezVous->count();
        $totalRevenue = $queryPaiements->where('statut', 'paye')->sum('montant');
        $totalPaiements = $queryPaiements->count();

        $usersByRole = User::select('role', DB::raw('count(*) as total'))
            ->groupBy('role')
            ->get()
            ->keyBy('role')
            ->map(fn($item) => $item->total)
            ->toArray();

        $patientsByAgeGroup = (clone $queryPatients)
            ->select(DB::raw("CASE
                WHEN date_naissance IS NULL THEN 'Non spécifié'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) < 18 THEN 'Moins de 18 ans'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) BETWEEN 18 AND 29 THEN '18-29 ans'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) BETWEEN 30 AND 49 THEN '30-49 ans'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) BETWEEN 50 AND 64 THEN '50-64 ans'
                ELSE '65 ans et plus'
            END AS age_group"), DB::raw('count(*) as total'))
            ->groupBy('age_group')
            ->get();

        $rendezVousByStatus = (clone $queryRendezVous)
            ->select('statut', DB::raw('count(*) as total'))
            ->groupBy('statut')
            ->get();

        $paiementsByStatus = (clone $queryPaiements)
            ->select('statut', DB::raw('count(*) as total'), DB::raw('SUM(montant) as total_amount'))
            ->groupBy('statut')
            ->get();

        return response()->json([
            'total_users' => $totalUsers,
            'users_by_role' => $usersByRole,
            'total_patients' => $totalPatients,
            'total_medecins' => $totalMedecins,
            'total_rendez_vous' => $totalRendezVous,
            'total_revenue' => $totalRevenue,
            'total_paiements' => $totalPaiements,
            'patients_by_age_group' => $patientsByAgeGroup,
            'rendez_vous_by_status' => $rendezVousByStatus,
            'paiements_by_status' => $paiementsByStatus,
        ]);
    }

    /**
     * Récupère les statistiques des patients.
     */
    public function getPatientStatistics(Request $request)
    {
        list($start, $end) = $this->getDateRange($request);

        $queryPatients = Patient::query();
        if ($start) {
            $queryPatients->whereBetween('created_at', [$start, $end]);
        }

        $newPatients = (clone $queryPatients)->count();

        $patientsByGender = (clone $queryPatients)
            ->select('sexe', DB::raw('count(*) as total'))
            ->groupBy('sexe')
            ->get();

        $patientsByAgeGroup = (clone $queryPatients)
            ->select(DB::raw("CASE
                WHEN date_naissance IS NULL THEN 'Non spécifié'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) < 18 THEN 'Moins de 18 ans'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) BETWEEN 18 AND 29 THEN '18-29 ans'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) BETWEEN 30 AND 49 THEN '30-49 ans'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance)) BETWEEN 50 AND 64 THEN '50-64 ans'
                ELSE '65 ans et plus'
            END AS age_group"), DB::raw('count(*) as total'))
            ->groupBy('age_group')
            ->get();

        $topPatientsByAppointments = RendezVous::select('patient_id', DB::raw('count(*) as total_appointments'))
            ->with('patient.user')
            ->whereBetween('date_heure', [$start, $end])
            ->groupBy('patient_id')
            ->orderByDesc('total_appointments')
            ->limit(10)
            ->get()
            ->map(function ($item) {
                return [
                    'patient_id' => $item->patient_id,
                    'patient_name' => $item->patient->user->nom . ' ' . $item->patient->user->prenom,
                    'total_appointments' => $item->total_appointments
                ];
            });

        return response()->json([
            'new_patients' => $newPatients,
            'patients_by_gender' => $patientsByGender,
            'patients_by_age_group' => $patientsByAgeGroup,
            'top_patients_by_appointments' => $topPatientsByAppointments,
        ]);
    }

    /**
     * Récupère les statistiques des médecins.
     */
    public function getMedecinStatistics(Request $request)
    {
        list($start, $end) = $this->getDateRange($request);

        $queryRendezVous = RendezVous::query();
        $queryPaiements = Paiement::query();

        if ($start) {
            $queryRendezVous->whereBetween('date_heure', [$start, $end]);
            $queryPaiements->whereBetween('date', [$start, $end]);
        }

        $medecinsBySpeciality = Medecin::select('specialite', DB::raw('count(*) as total'))
            ->groupBy('specialite')
            ->get();

        $appointmentsPerMedecin = (clone $queryRendezVous)
            ->select('medecin_id', DB::raw('count(*) as total_appointments'))
            ->with('medecin.user')
            ->groupBy('medecin_id')
            ->orderByDesc('total_appointments')
            ->get()
            ->map(function ($item) {
                return [
                    'medecin_id' => $item->medecin_id,
                    'medecin_name' => $item->medecin && $item->medecin->user
                        ? $item->medecin->user->nom . ' ' . $item->medecin->user->prenom
                        : 'Médecin inconnu',
                    'specialite' => $item->medecin ? $item->medecin->specialite : 'Non spécifié',
                    'total_appointments' => $item->total_appointments
                ];
            });

        $revenuePerMedecin = (clone $queryPaiements)
            ->join('rendez_vous', 'paiements.rendez_vous_id', '=', 'rendez_vous.id')
            ->select('rendez_vous.medecin_id', DB::raw('SUM(paiements.montant) as total_revenue'))
            ->where('paiements.statut', 'paye')
            ->with('rendezVous.medecin.user')
            ->groupBy('rendez_vous.medecin_id')
            ->orderByDesc('total_revenue')
            ->get()
            ->map(function ($item) {
                return [
                    'medecin_id' => $item->medecin_id,
                    'medecin_name' => $item->rendezVous && $item->rendezVous->medecin && $item->rendezVous->medecin->user
                        ? $item->rendezVous->medecin->user->nom . ' ' . $item->rendezVous->medecin->user->prenom
                        : 'Médecin inconnu',
                    'total_revenue' => $item->total_revenue
                ];
            });

        return response()->json([
            'medecins_by_speciality' => $medecinsBySpeciality,
            'appointments_per_medecin' => $appointmentsPerMedecin,
            'revenue_per_medecin' => $revenuePerMedecin,
        ]);
    }
    /**
     * Récupère les statistiques des rendez-vous.
     */
    public function getRendezVousStatistics(Request $request)
    {
        list($start, $end) = $this->getDateRange($request);
        $query = RendezVous::query();

        if ($start) {
            $query->whereBetween('date_heure', [$start, $end]);
        }

        if ($request->has('medecin_id')) {
            $query->where('medecin_id', $request->input('medecin_id'));
        }
        if ($request->has('patient_id')) {
            $query->where('patient_id', $request->input('patient_id'));
        }
        if ($request->has('statut')) {
            $query->where('statut', $request->input('statut'));
        }

        $totalRendezVous = (clone $query)->count();

        $rendezVousByStatus = (clone $query)
            ->select('statut', DB::raw('count(*) as total'))
            ->groupBy('statut')
            ->get();

        $rendezVousByMotif = (clone $query)
            ->select('motif', DB::raw('count(*) as total'))
            ->whereNotNull('motif')
            ->where('motif', '!=', '')
            ->groupBy('motif')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $cancelledReasons = (clone $query)
            ->where('statut', 'annule')
            ->select('reschedule_reason', 'reason', DB::raw('count(*) as total'))
            ->groupBy('reschedule_reason', 'reason')
            ->get();

        $rendezVousDaily = (clone $query)
            ->select(DB::raw('DATE(date_heure) as date'), DB::raw('count(*) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'total_rendez_vous' => $totalRendezVous,
            'rendez_vous_by_status' => $rendezVousByStatus,
            'rendez_vous_by_motif' => $rendezVousByMotif,
            'cancelled_reasons' => $cancelledReasons,
            'rendez_vous_daily' => $rendezVousDaily,
        ]);
    }

    /**
     * Récupère les statistiques des paiements.
     */
    public function getPaiementStatistics(Request $request)
    {
        list($start, $end) = $this->getDateRange($request);
        $query = Paiement::query();

        if ($start) {
            $query->whereBetween('date', [$start, $end]);
        }

        if ($request->has('statut')) {
            $query->where('statut', $request->input('statut'));
        }

        $totalPaiements = (clone $query)->count();
        $totalRevenue = (clone $query)->where('statut', 'paye')->sum('montant');
        $averagePayment = (clone $query)->where('statut', 'paye')->avg('montant');

        $paiementsByStatus = (clone $query)
            ->select('statut', DB::raw('count(*) as total'), DB::raw('SUM(montant) as total_amount'))
            ->groupBy('statut')
            ->get();

        $paiementsMonthly = (clone $query)
            ->select(DB::raw('TO_CHAR(date, \'YYYY-MM\') as month'), DB::raw('SUM(montant) as total_monthly_revenue'))
            ->where('statut', 'paye')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json([
            'total_paiements' => $totalPaiements,
            'total_revenue' => $totalRevenue,
            'average_payment' => $averagePayment,
            'paiements_by_status' => $paiementsByStatus,
            'paiements_monthly_revenue' => $paiementsMonthly,
        ]);
    }

    /**
     * Génère un fichier PDF pour un type de rapport spécifique et le sauvegarde dans la base de données.
     */
    public function generatePdfReport(Request $request, $reportType)
    {
        try {
            // Récupérer l'administrateur connecté
            $user = Auth::user();
            $administrateur = Administrateur::where('user_id', $user->id)->first();

            if (!$administrateur) {
                return response()->json(['error' => 'Utilisateur non autorisé. Seuls les administrateurs peuvent générer des rapports.'], 403);
            }

            list($start, $end) = $this->getDateRange($request);
            $data = [];
            $title = "Rapport Statistique";

            switch ($reportType) {
                case 'general':
                    $data = $this->getGeneralStatistics($request)->getData(true);
                    $title = "Rapport Général des Statistiques";
                    break;
                case 'patients':
                    $data = $this->getPatientStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Patients";
                    break;
                case 'medecins':
                    $data = $this->getMedecinStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Médecins";
                    break;
                case 'rendezvous':
                    $data = $this->getRendezVousStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Rendez-vous";
                    break;
                case 'paiements':
                    $data = $this->getPaiementStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Paiements";
                    break;
                default:
                    return response()->json(['message' => 'Type de rapport non valide.'], 400);
            }

            // Sauvegarder le rapport dans la table rapports
            $rapport = Rapport::create([
                'titre' => $title,
                'date_generation' => Carbon::now(),
                'type' => $reportType,
                'contenu' => json_encode($data),
                'format' => 'pdf',
                'administrateur_id' => $administrateur->id,
            ]);

            $pdf = Pdf::loadView('pdf.statistics_report', compact('data', 'title', 'start', 'end'));
            return $pdf->download(str_replace(' ', '_', $title) . '_' . Carbon::now()->format('Ymd_His') . '.pdf');
        } catch (\Exception $e) {
            \Log::error('Erreur lors de la génération du PDF: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erreur lors de la génération du PDF',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Génère un fichier Excel pour un type de rapport spécifique et le sauvegarde dans la base de données.
     */
    public function generateExcelReport(Request $request, $reportType)
    {
        try {
            // Récupérer l'administrateur connecté
            $user = Auth::user();
            $administrateur = Administrateur::where('user_id', $user->id)->first();

            if (!$administrateur) {
                return response()->json(['error' => 'Utilisateur non autorisé. Seuls les administrateurs peuvent générer des rapports.'], 403);
            }

            list($start, $end) = $this->getDateRange($request);
            $data = [];
            $title = "Rapport Statistique";
            $sheetData = [];

            switch ($reportType) {
                case 'general':
                    $data = $this->getGeneralStatistics($request)->getData(true);
                    $title = "Rapport Général des Statistiques";
                    $sheetData[] = ['Statistique', 'Valeur'];
                    $sheetData[] = ['Total Utilisateurs', $data['total_users'] ?? 0];
                    $sheetData[] = ['Total Patients', $data['total_patients'] ?? 0];
                    $sheetData[] = ['Total Médecins', $data['total_medecins'] ?? 0];
                    $sheetData[] = ['Total Rendez-vous', $data['total_rendez_vous'] ?? 0];
                    $sheetData[] = ['Total Chiffre d\'affaires', $data['total_revenue'] ?? 0];
                    $sheetData[] = ['Total Paiements', $data['total_paiements'] ?? 0];
                    $sheetData[] = ['Utilisateurs par Rôle', ''];
                    foreach (($data['users_by_role'] ?? []) as $role => $count) {
                        $sheetData[] = [$role, $count];
                    }
                    $sheetData[] = ['Patients par Tranche d\'âge', ''];
                    foreach (($data['patients_by_age_group'] ?? []) as $item) {
                        $sheetData[] = [$item['age_group'], $item['total']];
                    }
                    $sheetData[] = ['Rendez-vous par Statut', ''];
                    foreach (($data['rendez_vous_by_status'] ?? []) as $item) {
                        $sheetData[] = [$item['statut'], $item['total']];
                    }
                    $sheetData[] = ['Paiements par Statut', ''];
                    foreach (($data['paiements_by_status'] ?? []) as $item) {
                        $sheetData[] = [$item['statut'], $item['total'], $item['total_amount']];
                    }
                    break;
                case 'patients':
                    $data = $this->getPatientStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Patients";
                    $sheetData[] = ['Statistique', 'Valeur'];
                    $sheetData[] = ['Nouveaux Patients', $data['new_patients'] ?? 0];
                    $sheetData[] = ['Patients par Sexe', ''];
                    foreach (($data['patients_by_gender'] ?? []) as $item) {
                        $sheetData[] = [$item['sexe'], $item['total']];
                    }
                    $sheetData[] = ['Patients par Tranche d\'âge', ''];
                    foreach (($data['patients_by_age_group'] ?? []) as $item) {
                        $sheetData[] = [$item['age_group'], $item['total']];
                    }
                    $sheetData[] = ['Top Patients par Rendez-vous', ''];
                    $sheetData[] = ['Nom du Patient', 'Total Rendez-vous'];
                    foreach (($data['top_patients_by_appointments'] ?? []) as $item) {
                        $sheetData[] = [$item['patient_name'], $item['total_appointments']];
                    }
                    break;
                case 'medecins':
                    $data = $this->getMedecinStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Médecins";
                    $sheetData[] = ['Statistique', 'Valeur'];
                    $sheetData[] = ['Médecins par Spécialité', ''];
                    foreach (($data['medecins_by_speciality'] ?? []) as $item) {
                        $sheetData[] = [$item['specialite'], $item['total']];
                    }
                    $sheetData[] = ['Rendez-vous par Médecin', ''];
                    $sheetData[] = ['Nom du Médecin', 'Spécialité', 'Total Rendez-vous'];
                    foreach (($data['appointments_per_medecin'] ?? []) as $item) {
                        $sheetData[] = [$item['medecin_name'], $item['specialite'], $item['total_appointments']];
                    }
                    $sheetData[] = ['Revenus par Médecin', ''];
                    $sheetData[] = ['Nom du Médecin', 'Total Revenu'];
                    foreach (($data['revenue_per_medecin'] ?? []) as $item) {
                        $sheetData[] = [$item['medecin_name'], $item['total_revenue']];
                    }
                    break;
                case 'rendezvous':
                    $data = $this->getRendezVousStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Rendez-vous";
                    $sheetData[] = ['Statistique', 'Valeur'];
                    $sheetData[] = ['Total Rendez-vous', $data['total_rendez_vous'] ?? 0];
                    $sheetData[] = ['Rendez-vous par Statut', ''];
                    foreach (($data['rendez_vous_by_status'] ?? []) as $item) {
                        $sheetData[] = [$item['statut'], $item['total']];
                    }
                    $sheetData[] = ['Rendez-vous par Motif', ''];
                    foreach (($data['rendez_vous_by_motif'] ?? []) as $item) {
                        $sheetData[] = [$item['motif'], $item['total']];
                    }
                    $sheetData[] = ['Raison d\'Annulation', ''];
                    $sheetData[] = ['Raison de Report', 'Raison Générale', 'Total'];
                    foreach (($data['cancelled_reasons'] ?? []) as $item) {
                        $sheetData[] = [$item['reschedule_reason'], $item['reason'], $item['total']];
                    }
                    $sheetData[] = ['Rendez-vous Quotidiens', ''];
                    $sheetData[] = ['Date', 'Total'];
                    foreach (($data['rendez_vous_daily'] ?? []) as $item) {
                        $sheetData[] = [$item['date'], $item['total']];
                    }
                    break;
                case 'paiements':
                    $data = $this->getPaiementStatistics($request)->getData(true);
                    $title = "Rapport Statistique des Paiements";
                    $sheetData[] = ['Statistique', 'Valeur'];
                    $sheetData[] = ['Total Paiements', $data['total_paiements'] ?? 0];
                    $sheetData[] = ['Total Revenu', $data['total_revenue'] ?? 0];
                    $sheetData[] = ['Paiement Moyen', $data['average_payment'] ?? 0];
                    $sheetData[] = ['Paiements par Statut', ''];
                    foreach (($data['paiements_by_status'] ?? []) as $item) {
                        $sheetData[] = [$item['statut'], $item['total'], $item['total_amount']];
                    }
                    $sheetData[] = ['Revenu Mensuel', ''];
                    $sheetData[] = ['Mois', 'Revenu'];
                    foreach (($data['paiements_monthly_revenue'] ?? []) as $item) {
                        $sheetData[] = [$item['month'], $item['total_monthly_revenue']];
                    }
                    break;
                default:
                    return response()->json(['message' => 'Type de rapport non valide.'], 400);
            }

            // Sauvegarder le rapport dans la table rapports
            $rapport = Rapport::create([
                'titre' => $title,
                'date_generation' => Carbon::now(),
                'type' => $reportType,
                'contenu' => json_encode($data),
                'format' => 'excel',
                'administrateur_id' => $administrateur->id,
            ]);

            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle(substr($title, 0, 31));

            $sheet->fromArray($sheetData, null, 'A1');

            $fileName = str_replace(' ', '_', $title) . '_' . Carbon::now()->format('Ymd_His') . '.xlsx';
            $writer = new Xlsx($spreadsheet);

            $response = new StreamedResponse(
                function () use ($writer) {
                    $writer->save('php://output');
                }
            );

            $response->headers->set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            $response->headers->set('Content-Disposition', 'attachment;filename="' . $fileName . '"');
            $response->headers->set('Cache-Control', 'max-age=0');

            return $response;
        } catch (\Exception $e) {
            \Log::error('Erreur lors de la génération du fichier Excel: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erreur lors de la génération du fichier Excel',
                'details' => $e->getMessage()
            ], 500);
        }
    }
}
