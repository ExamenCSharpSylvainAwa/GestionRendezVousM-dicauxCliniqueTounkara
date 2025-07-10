<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Notification;
use Illuminate\Support\Facades\Validator;

class NotificationController extends Controller
{
    public function index()
    {
        $notifications = Notification::with('rendezVous.patient.user')->paginate(10);
        return response()->json($notifications);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|string',
            'contenu' => 'required|string',
            'date_envoi' => 'required|date',
            'methode_envoi' => 'required|in:email,sms',
            'rendez_vous_id' => 'nullable|exists:rendez_vous,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $notification = Notification::create($request->all());
        return response()->json($notification->load('rendezVous.patient.user'), 201);
    }

    public function show(Notification $notification)
    {
        return response()->json($notification->load('rendezVous.patient.user'));
    }

    public function update(Request $request, Notification $notification)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'sometimes|required|string',
            'contenu' => 'sometimes|required|string',
            'date_envoi' => 'sometimes|required|date',
            'methode_envoi' => 'sometimes|in:email,sms',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $notification->update($request->all());
        return response()->json($notification->load('rendezVous.patient.user'));
    }

    public function destroy(Notification $notification)
    {
        $notification->delete();
        return response()->json(['message' => 'Notification supprimée avec succès']);
    }

    public function sendNotification(Notification $notification)
    {
        // Logique d'envoi (exemple avec email via Laravel Mail)
        if ($notification->methode_envoi === 'email') {
            // Implémenter l'envoi d'email (nécessite une configuration Mail)
            $notification->update(['envoye' => true, 'statut' => 'envoye']);
        } elseif ($notification->methode_envoi === 'sms') {
            // Implémenter l'envoi SMS (nécessite une API comme Twilio)
            $notification->update(['envoye' => true, 'statut' => 'envoye']);
        }
        return response()->json(['message' => 'Notification envoyée']);
    }
}
