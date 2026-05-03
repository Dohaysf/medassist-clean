import { useState } from 'react';
import { reverseGeocode } from '../services/geocodingService';

const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resetError = () => setError(null);

  const getLocation = async (onSuccess = null) => {
    setLoading(true);
    setError(null);

    // Vérifier l'état de la permission si l'API est disponible
    let permissionState = 'prompt';
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        permissionState = permissionStatus.state;
        console.log('Permission state:', permissionState);
      } catch (permErr) {
        console.warn('Impossible de vérifier la permission', permErr);
      }
    }

    if (permissionState === 'denied') {
      setError(
        'La géolocalisation a été bloquée par votre navigateur. ' +
        'Cliquez sur le cadenas 🔒 à gauche de l\'URL, puis autorisez l\'accès à la position.'
      );
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setError('La géolocalisation n\'est pas supportée par votre navigateur.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          setLocation(address);
          
          // Appeler le callback avec la position brute si fourni
          if (onSuccess && typeof onSuccess === 'function') {
            onSuccess({ latitude, longitude, address });
          }
        } catch (err) {
          setError('Impossible de convertir la position en adresse.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error(err);
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            'Vous avez refusé la géolocalisation. Pour partager votre position, ' +
            'cliquez sur le cadenas 🔒 à gauche de l\'URL, puis autorisez l\'accès.'
          );
        } else {
          setError('Une erreur est survenue lors de la géolocalisation.');
        }
        setLoading(false);
      }
    );
  };

  return { location, loading, error, getLocation, resetError };
};

export default useGeolocation;