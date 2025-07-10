<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\RendezVous;
use App\Models\Medecin;
use App\Models\Patient;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;
use Illuminate\Http\Request;

class RendezVousController extends Controller
{
    public function index()
    {
        $rendezVous = RendezVous::with(['patient.user', 'medecin.user'])->paginate(10);
        return response()->json($rendezVous);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'patient_id' => 'required|exists:patients,id',
            'medecin_id' => 'required|exists:medecins,id',
            'date_heure' => 'required|date|after:now',
            'motif' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $medecin = Medecin::find($request->medecin_id);
        if (!$this->verifierDisponibilite($medecin, $request->date_heure)) {
            return response()->json(['message' => 'Médecin non disponible à cette heure'], 400);
        }

        $rendezVous = RendezVous::create([
            'patient_id' => $request->patient_id,
            'medecin_id' => $request->medecin_id,
            'date_heure' => $request->date_heure,
            'motif' => $request->motif,
            'tarif' => $medecin->tarif_consultation,
        ]);

        return response()->json($rendezVous->load(['patient.user', 'medecin.user']), 201);
    }

    private function verifierDisponibilite($medecin, $dateHeure)
    {
        $date = Carbon::parse($dateHeure);
        $jour = strtolower($date->format('l'));
        $heure = $date->format('H:i');

        if (!isset($medecin->horaire_consultation[$jour])) {
            return false;
        }

        $horaires = $medecin->horaire_consultation[$jour];
        if ($heure < $horaires['debut'] || $heure > $horaires['fin']) {
            return false;
        }

        $existant = RendezVous::where('medecin_id', $medecin->id)
            ->where('date_heure', $dateHeure)
            ->where('statut', '!=', 'annule')
            ->exists();

        return !$existant;
    }

    public function show(RendezVous $rendezVous)
    {
        return response()->json($rendezVous->load(['patient.user', 'medecin.user']));
    }

    public function update(Request $request, RendezVous $rendezVous)
    {
        $validator = Validator::make($request->all(), [
            'date_heure' => 'sometimes|date|after:now',
            'motif' => 'sometimes|string',
            'statut' => 'sometimes|in:en_attente,confirme,annule,termine',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->has('date_heure') && $request->date_heure) {
            $medecin = $rendezVous->medecin;
            if (!$this->verifierDisponibilite($medecin, $request->date_heure)) {
                return response()->json(['message' => 'Médecin non disponible à cette heure'], 400);
            }
        }

        $rendezVous->update($request->all());
        return response()->json($rendezVous->load(['patient.user', 'medecin.user']));
    }

    public function destroy(RendezVous $rendezVous)
    {
        $rendezVous->update(['statut' => 'annule']);
        return response()->json(['message' => 'Rendez-vous annulé avec succès']);
    }
}
