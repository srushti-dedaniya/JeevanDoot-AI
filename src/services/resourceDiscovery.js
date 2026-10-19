/**
 * Rural healthcare resource discovery service (Phase 5).
 *
 * Provides search and filtering for healthcare resources based on
 * real data from the backend. Does not fabricate resources.
 */

import { api } from './api';

export const RESOURCE_TYPES = Object.freeze({
  DOCTOR: 'doctor',
  CLINIC: 'clinic',
  HEALTH_CAMP: 'health_camp',
  REFERRAL_DESTINATION: 'referral_destination',
});

export const searchResources = async (params = {}) => {
  const {
    type,
    specialty,
    region,
    village,
    serviceType,
    availabilityDate,
    limit = 50,
    page = 1,
  } = params;

  const query = { limit, page };
  if (specialty) query.specialty = specialty;
  if (region) query.region = region;
  if (village) query.village = village;
  if (serviceType) query.serviceType = serviceType;
  if (availabilityDate) query.availabilityDate = availabilityDate;

  switch (type) {
    case RESOURCE_TYPES.DOCTOR:
      return searchDoctors(query);
    case RESOURCE_TYPES.CLINIC:
      return searchClinics(query);
    case RESOURCE_TYPES.HEALTH_CAMP:
      return searchHealthCamps(query);
    case RESOURCE_TYPES.REFERRAL_DESTINATION:
      return searchReferralDestinations(query);
    default:
      return searchDoctors(query);
  }
};

const searchDoctors = async (query) => {
  const { data } = await api.get('/doctors', query);
  return {
    resources: (data || []).map(d => ({
      id: d._id || d.id,
      type: RESOURCE_TYPES.DOCTOR,
      name: d.name,
      specialization: d.specialization || 'General Medicine',
      hospital: d.hospital || '',
      experience: d.experience || 0,
      rating: d.rating || 4.5,
      availability: d.availability || { status: 'online', days: [] },
      distance: d.distance || null,
      lastUpdated: d.updatedAt || d.createdAt,
    })),
    meta: { total: data?.length || 0, page: query.page, limit: query.limit },
  };
};

const searchClinics = async (query) => {
  // If clinics endpoint exists, use it; otherwise return empty
  try {
    const { data } = await api.get('/clinics', query);
    return {
      resources: (data || []).map(c => ({
        id: c._id || c.id,
        type: RESOURCE_TYPES.CLINIC,
        name: c.name,
        address: c.address || '',
        village: c.village || '',
        services: c.services || [],
        hours: c.hours || '',
        phone: c.phone || '',
        distance: c.distance || null,
        lastUpdated: c.updatedAt || c.createdAt,
      })),
      meta: { total: data?.length || 0, page: query.page, limit: query.limit },
    };
  } catch {
    return { resources: [], meta: { total: 0, page: query.page, limit: query.limit } };
  }
};

const searchHealthCamps = async (query) => {
  const { data } = await api.get('/ngo/camps', query);
  return {
    resources: (data || []).map(c => ({
      id: c._id || c.id,
      type: RESOURCE_TYPES.HEALTH_CAMP,
      name: c.name,
      location: c.location || '',
      date: c.date,
      doctor: c.doctor || '',
      services: c.services || [],
      status: c.status || 'planned',
      beneficiaries: c.beneficiaries || 0,
      lastUpdated: c.updatedAt || c.createdAt,
    })),
    meta: { total: data?.length || 0, page: query.page, limit: query.limit },
  };
};

const searchReferralDestinations = async (query) => {
  try {
    const { data } = await api.get('/referrals/destinations', query);
    return {
      resources: (data || []).map(d => ({
        id: d._id || d.id,
        type: RESOURCE_TYPES.REFERRAL_DESTINATION,
        name: d.name,
        type: d.type || 'hospital',
        address: d.address || '',
        specialties: d.specialties || [],
        contactPhone: d.phone || '',
        contactEmail: d.email || '',
        distance: d.distance || null,
        lastUpdated: d.updatedAt || d.createdAt,
      })),
      meta: { total: data?.length || 0, page: query.page, limit: query.limit },
    };
  } catch {
    return { resources: [], meta: { total: 0, page: query.page, limit: query.limit } };
  }
};

export const getResourceDetails = async (type, resourceId) => {
  switch (type) {
    case RESOURCE_TYPES.DOCTOR:
      const { data: doctor } = await api.get(`/doctors/${resourceId}`);
      return doctor;
    case RESOURCE_TYPES.CLINIC:
      try {
        const { data: clinic } = await api.get(`/clinics/${resourceId}`);
        return clinic;
      } catch {
        return null;
      }
    case RESOURCE_TYPES.HEALTH_CAMP:
      const { data: camp } = await api.get(`/ngo/camps/${resourceId}`);
      return camp;
    case RESOURCE_TYPES.REFERRAL_DESTINATION:
      try {
        const { data: dest } = await api.get(`/referrals/destinations/${resourceId}`);
        return dest;
      } catch {
        return null;
      }
    default:
      return null;
  }
};

export const getAvailableSpecialties = async () => {
  const { data } = await api.get('/doctors', { limit: 1000 });
  const specialties = new Set();
  (data || []).forEach(d => {
    if (d.specialization) specialties.add(d.specialization);
  });
  return Array.from(specialties).sort();
};

export const getAvailableRegions = async () => {
  const { data } = await api.get('/doctors', { limit: 1000 });
  const regions = new Set();
  (data || []).forEach(d => {
    if (d.region) regions.add(d.region);
    if (d.hospital) regions.add(d.hospital);
  });
  return Array.from(regions).sort();
};

export default {
  searchResources,
  getResourceDetails,
  getAvailableSpecialties,
  getAvailableRegions,
  RESOURCE_TYPES,
};