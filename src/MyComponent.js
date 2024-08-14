import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLoadScript, GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import Select from 'react-select';
import './Styles.css';
import { gapi } from 'gapi-script';

const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
const API_KEY = process.env.REACT_APP_API_KEY;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const libraries = ['places', 'geometry'];
const mapContainerStyle = {
    width: '100%',
    height: '400px',
};
const customStyles = {
    menu: (provided) => ({
        ...provided,
        top: '100%',
        position: 'absolute',
        width: '100%',
        zIndex: 1,
        backgroundColor: '#515151',
        borderRadius: '4px',
        boxShadow: '0 0 0 1px hsla(0, 0%, 0%, 0.1), 0 4px 11px rgba(0, 0, 0, 0)',
        marginBottom: '8px',
        marginTop: '8px',
        boxSizing: 'border-box',
    }),
    control: (provided) => ({
        ...provided,
        border: '1px solid #ccc',
        boxShadow: 'none',
        '&:hover': {
            border: '1px solid #aaa',
        },
    }),
};

const MyComponent = () => {

    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: API_KEY,
        libraries,
    });

    
    const [countries, setCountries] = useState([]);
    const [origin, setOrigin] = useState({ lat: null, lng: null });
    const [destination, setDestination] = useState({ lat: null, lng: null });
    const [originAddress, setOriginAddress] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [country, setCountry] = useState(null);
    const [responseData, setResponseData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [polylinePath, setPolylinePath] = useState(null);
    const originInputRef = useRef(null);
    const destinationInputRef = useRef(null);
    const mapRef = useRef(null);


    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const fetchCountries = async () => {
        try {
            const response = await axios.get('https://restcountries.com/v3.1/all');
            const countryOptions = response.data.map(country => ({
                value: country.cca2,
                label: country.name.common,
            }));
            setCountries(countryOptions);
        } catch (err) {
            console.error('Error fetching countries:', err);
        }
    };

    useEffect(() => {
        fetchCountries();
    }, []);

    const handleSelect = (place, setLocation, setAddress) => {
        if (place.geometry) {
            setLocation({
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
            });
            setAddress(place.formatted_address);
        }
    };

    const initAutocomplete = useCallback((inputRef, setLocation, setAddress) => {
        const options = {
            componentRestrictions: { country: country?.value },
            fields: ['formatted_address', 'geometry'],
        };

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, options);
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            handleSelect(place, setLocation, setAddress);
        });
    }, [country]);

    useEffect(() => {
        if (isLoaded) {
            initAutocomplete(originInputRef, setOrigin, setOriginAddress);
            initAutocomplete(destinationInputRef, setDestination, setDestinationAddress);
        }
    }, [isLoaded, initAutocomplete]);

    const formatDistance = (distanceMeters) => {
        return (distanceMeters / 1000).toFixed(2) + ' km';
        
      };
    
    const formatDuration = (durationSeconds) => {
        if (typeof durationSeconds === 'string' && durationSeconds.endsWith('s')) {
            durationSeconds = parseInt(durationSeconds.slice(0, -1), 10);
        }
        const hours = Math.floor(durationSeconds / 3600);

        const minutes = Math.floor((durationSeconds % 3600) / 60);
        return `${hours} hrs ${minutes} mins`;
      };
    const generateGoogleMapsLink = (origin, destination) => {
        const originStr = `${origin.lat},${origin.lng}`;
        const destinationStr = `${destination.lat},${destination.lng}`;
        return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destinationStr}&travelmode=driving`;
    };

    const [isSignedIn, setIsSignedIn] = useState(false);

    useEffect(() => {
        const start = () => {
            gapi.client.init({
                apiKey: API_KEY,
                clientId: CLIENT_ID,
                discoveryDocs: DISCOVERY_DOCS,
                scope: SCOPES,
            }).then(() => {
                const authInstance = gapi.auth2.getAuthInstance();
                setIsSignedIn(authInstance.isSignedIn.get());

                authInstance.isSignedIn.listen(setIsSignedIn);
            }).catch(error => {
                console.error('Error during gapi.client.init:', error);
            });
        };

        gapi.load('client:auth2', start);
    }, []);

    const handleAuthClick = () => {
        gapi.auth2.getAuthInstance().signIn();
    };

    const handleSignOutClick = () => {
        gapi.auth2.getAuthInstance().signOut();
    };

    const getTimeZoneForLocation = async (lat, lng) => {
        const timeZoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${API_KEY}`;
    
        try {
            const response = await axios.get(timeZoneUrl);
            if (response.data.status === 'OK') {
                return response.data.timeZoneId;
            } else {
                console.error('Error fetching time zone:', response.data.status);
                return 'UTC'; 
            }
        } catch (error) {
            console.error('Error fetching time zone:', error);
            return 'UTC'; 
        }
    };
    
    const addEventToCalendar = async () => {
       
        const departureDate = new Date(departureTime);
    
        
        const durationSeconds = parseInt(responseData.routes[0].duration, 10);
        const arrivalDate = new Date(departureDate.getTime() + durationSeconds * 1000);
    
        
        const timeZone = await getTimeZoneForLocation(origin.lat, origin.lng);
    
        const event = {
            summary: 'Driving Route',
            description: 'Your planned driving route',
            start: {
                dateTime: departureDate.toISOString(),
                timeZone: timeZone,
            },
            end: {
                dateTime: arrivalDate.toISOString(),
                timeZone: timeZone,
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 10 },
                ],
            },
        };
    
        gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        }).then(response => {
            console.log('Event created: ', response);
        }).catch(error => {
            console.error('Error creating event: ', error);
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const payload = {
            origin: {
                location: {
                    latLng: {
                        latitude: origin.lat,
                        longitude: origin.lng,
                    },
                },
            },
            destination: {
                location: {
                    latLng: {
                        latitude: destination.lat,
                        longitude: destination.lng,
                    },
                },
            },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
            departureTime: departureTime ? new Date(departureTime).toISOString() : undefined,
            computeAlternativeRoutes: false,
            routeModifiers: {
                avoidTolls: false,
                avoidHighways: false,
                avoidFerries: false,
            },
            languageCode: 'en-US',
            units: 'IMPERIAL',
        };
        console.log('Payload:', payload);
        const headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        };
        console.log('Headers:', headers);
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(url, payload, { headers });
            if (response.status === 200) {
                setResponseData(response.data);
                const route = response.data.routes[0];
                const decodedPath = window.google.maps.geometry.encoding.decodePath(
                    route.polyline.encodedPolyline
                );
                setPolylinePath(decodedPath);
                setOrigin({
                    lat: payload.origin.location.latLng.latitude,
                    lng: payload.origin.location.latLng.longitude,
                });
                setDestination({
                    lat: payload.destination.location.latLng.latitude,
                    lng: payload.destination.location.latLng.longitude,
                });
            } else {
                setError(`Request failed with status code ${response.status}`);
            }
        } catch (err) {
            setError(`Request failed: ${err.message}`);
        }

        setLoading(false);
    };

    if (loadError) return 'Error loading maps';
    if (!isLoaded) return 'Loading Maps';

    return (
        <div className="container">
            <h1 className="title">Google Maps Traffic Planner</h1>
            {isSignedIn ? (
                <div>
                    <button onClick={handleSignOutClick}>Sign Out</button>
                    <button onClick={addEventToCalendar}>Save Route to Google Calendar</button>
                </div>
            ) : (
                <button onClick={handleAuthClick}>Sign in with Google</button>
            )}
            <form onSubmit={handleSubmit} className="form">
                <div className="form-group">
                    <label className="form-label">
                        Country:
                        <Select
                            styles={customStyles}
                            options={countries}
                            value={country}
                            onChange={setCountry}
                            required
                        />
                    </label>
                </div>
                <div className="form-group">
                    <label className="form-label">
                        Origin Address:
                        <input
                            type="text"
                            ref={originInputRef}
                            value={originAddress}
                            onChange={(e) => setOriginAddress(e.target.value)}
                            className="form-input"
                            required
                        />
                    </label>
                </div>
                <div className="form-group">
                    <label className="form-label">
                        Destination Address:
                        <input
                            type="text"
                            ref={destinationInputRef}
                            value={destinationAddress}
                            onChange={(e) => setDestinationAddress(e.target.value)}
                            className="form-input"
                            required
                        />
                    </label>
                </div>
                <div className="form-group">
                    <label className="form-label">
                        Departure Time:
                        <input
                            type="datetime-local"
                            value={departureTime}
                            onChange={(e) => setDepartureTime(e.target.value)}
                            className="form-input"
                            required
                        />
                    </label>
                </div>
                <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? 'Loading...' : 'Get Directions'}
                </button>
            </form>
            {error && <div className="error-message">{error}</div>}
            {responseData && (
                <div className="result">
                    <h2>Route Details</h2>
                    <p>Distance: {formatDistance(responseData.routes[0].distanceMeters)}</p>
                    <p>Duration: {formatDuration(responseData.routes[0].duration)}</p>
                    <a
                        href={generateGoogleMapsLink(origin, destination)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open in Google Maps
                    </a>
                </div>)}
            <GoogleMap
                id="map"
                mapContainerStyle={mapContainerStyle}
                zoom={8}
                center={origin.lat && origin.lng ? origin : { lat: -1.2921, lng: 36.8219 }}
                onLoad={(map) => (mapRef.current = map)}
            >
                {origin.lat && origin.lng && (
                    <Marker position={{ lat: origin.lat, lng: origin.lng }} />
                )}
                {destination.lat && destination.lng && (
                    <Marker position={{ lat: destination.lat, lng: destination.lng }} />
                )}
                {polylinePath && (
                    <Polyline
                        path={polylinePath}
                        options={{
                            strokeColor: '#FF0000',
                            strokeOpacity: 0.8,
                            strokeWeight: 4,
                        }}
                    />
                )}
            </GoogleMap>
        </div>
    );

};

export default MyComponent;
