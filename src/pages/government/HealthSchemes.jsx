import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import SearchBar from '../../components/common/SearchBar';
import KPIWidget from '../../components/charts/KPIWidget';
import { GOVERNMENT_NAV } from './governmentNav';

const SCHEMES = [
  { id: 'PM-JAY', budget: '₹5,00,000', registrations: 12486, target: 19500, status: 'Active' },
  { id: 'NHM', budget: '₹8,00,000', registrations: 8975, target: 17500, status: 'Active' },
  { id: 'MI', budget: '₹2,40,000', registrations: 5612, target: 6000, status: 'Active' },
  { id: 'PMMVY', budget: '₹1,80,000', registrations: 3240, target: 4500, status: 'Active' },
  { id: 'NPCDCS', budget: '₹2,10,000', registrations: 4330, target: 8000, status: 'Active' },
  { id: 'RBSK', budget: '₹1,20,000', registrations: 2108, target: 4000, status: 'Active' },
  { id: 'PMSMA', budget: '₹95,000', registrations: 1892, target: 3500, status: 'Active' },
];

const totalRegistrations = SCHEMES.reduce((sum, scheme) => sum + scheme.registrations, 0);
const totalBudget = SCHEMES.reduce((sum, scheme) => sum + Number(scheme.budget.replace(/[₹,]/g, '')), 0);
const averageCoverage = Math.round((totalRegistrations / SCHEMES.reduce((sum, scheme) => sum + scheme.target, 0)) * 100);

const BENEFICIARIES = {
  'PM-JAY': [
    { name: 'Ramesh Kumar', id: 'PMJ-2201', village: 'Amroli', age: 45, gender: 'Male', date: 'Oct 12' },
    { name: 'Sunita Devi', id: 'PMJ-2202', village: 'Palia', age: 38, gender: 'Female', date: 'Oct 10' },
    { name: 'Anil Verma', id: 'PMJ-2203', village: 'Devgram', age: 52, gender: 'Male', date: 'Oct 08' },
    { name: 'Meera Sharma', id: 'PMJ-2204', village: 'Kanker East', age: 29, gender: 'Female', date: 'Oct 05' },
    { name: 'Gopal Prasad', id: 'PMJ-2205', village: 'Dhamtari Rural', age: 61, gender: 'Male', date: 'Oct 03' },
    { name: 'Laxmi Verma', id: 'PMJ-2206', village: 'Lormi Block', age: 34, gender: 'Female', date: 'Sep 28' },
    { name: 'Rajesh Kumar', id: 'PMJ-2207', village: 'Bijapur Sector 2', age: 48, gender: 'Male', date: 'Sep 25' },
    { name: 'Kavita Patel', id: 'PMJ-2208', village: 'Amroli', age: 26, gender: 'Female', date: 'Sep 22' },
  ],
  NHM: [
    { name: 'Suresh Yadav', id: 'NHM-1101', village: 'Palia', age: 40, gender: 'Male', date: 'Oct 14' },
    { name: 'Geeta Bai', id: 'NHM-1102', village: 'Devgram', age: 33, gender: 'Female', date: 'Oct 11' },
    { name: 'Mohan Das', id: 'NHM-1103', village: 'Amroli', age: 55, gender: 'Male', date: 'Oct 09' },
    { name: 'Rekha Sahu', id: 'NHM-1104', village: 'Kanker East', age: 27, gender: 'Female', date: 'Oct 06' },
    { name: 'Prakash Naik', id: 'NHM-1105', village: 'Lormi Block', age: 44, gender: 'Male', date: 'Oct 02' },
    { name: 'Sarita Kori', id: 'NHM-1106', village: 'Bijapur Sector 2', age: 31, gender: 'Female', date: 'Sep 30' },
  ],
  MI: [
    { name: 'Ravi Patle', id: 'MI-3301', village: 'Palia', age: 6, gender: 'Male', date: 'Oct 15' },
    { name: 'Priya Netam', id: 'MI-3302', village: 'Devgram', age: 4, gender: 'Female', date: 'Oct 13' },
    { name: 'Aarav Tandi', id: 'MI-3303', village: 'Amroli', age: 8, gender: 'Male', date: 'Oct 11' },
    { name: 'Sneha Markam', id: 'MI-3304', village: 'Kanker East', age: 3, gender: 'Female', date: 'Oct 07' },
    { name: 'Vikas Baghel', id: 'MI-3305', village: 'Lormi Block', age: 7, gender: 'Male', date: 'Oct 04' },
    { name: 'Aarti Yadav', id: 'MI-3306', village: 'Bijapur Sector 2', age: 5, gender: 'Female', date: 'Oct 01' },
  ],
  PMMVY: [
    { name: 'Sunita Devi', id: 'PMV-4401', village: 'Palia', age: 28, gender: 'Female', date: 'Oct 13' },
    { name: 'Kavita Patel', id: 'PMV-4402', village: 'Amroli', age: 24, gender: 'Female', date: 'Oct 10' },
    { name: 'Rekha Sahu', id: 'PMV-4403', village: 'Kanker East', age: 31, gender: 'Female', date: 'Oct 08' },
    { name: 'Geeta Bai', id: 'PMV-4404', village: 'Devgram', age: 26, gender: 'Female', date: 'Oct 05' },
    { name: 'Sarita Kori', id: 'PMV-4405', village: 'Bijapur Sector 2', age: 29, gender: 'Female', date: 'Oct 02' },
  ],
  NPCDCS: [
    { name: 'Ram Prasad', id: 'NCD-5501', village: 'Amroli', age: 58, gender: 'Male', date: 'Oct 12' },
    { name: 'Shakuntala Bai', id: 'NCD-5502', village: 'Devgram', age: 54, gender: 'Female', date: 'Oct 09' },
    { name: 'Hari Om', id: 'NCD-5503', village: 'Palia', age: 63, gender: 'Male', date: 'Oct 07' },
    { name: 'Kamla Devi', id: 'NCD-5504', village: 'Kanker East', age: 49, gender: 'Female', date: 'Oct 04' },
    { name: 'Devendra Singh', id: 'NCD-5505', village: 'Lormi Block', age: 57, gender: 'Male', date: 'Sep 29' },
    { name: 'Mina Kujur', id: 'NCD-5506', village: 'Bijapur Sector 2', age: 46, gender: 'Female', date: 'Sep 26' },
  ],
  RBSK: [
    { name: 'Aarav Tandi', id: 'RBS-6601', village: 'Amroli', age: 9, gender: 'Male', date: 'Oct 14' },
    { name: 'Diya Netam', id: 'RBS-6602', village: 'Palia', age: 7, gender: 'Female', date: 'Oct 12' },
    { name: 'Om Prakash', id: 'RBS-6603', village: 'Devgram', age: 11, gender: 'Male', date: 'Oct 09' },
    { name: 'Tara Bai', id: 'RBS-6604', village: 'Kanker East', age: 6, gender: 'Female', date: 'Oct 06' },
    { name: 'Vikram Markam', id: 'RBS-6605', village: 'Lormi Block', age: 10, gender: 'Male', date: 'Oct 03' },
  ],
  PMSMA: [
    { name: 'Kavita Patel', id: 'PMS-7701', village: 'Amroli', age: 25, gender: 'Female', date: 'Oct 15' },
    { name: 'Geeta Bai', id: 'PMS-7702', village: 'Devgram', age: 27, gender: 'Female', date: 'Oct 11' },
    { name: 'Rekha Sahu', id: 'PMS-7703', village: 'Kanker East', age: 30, gender: 'Female', date: 'Oct 06' },
    { name: 'Sunita Devi', id: 'PMS-7704', village: 'Palia', age: 26, gender: 'Female', date: 'Oct 02' },
  ],
};

export default function HealthSchemes() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [beneficiaryQuery, setBeneficiaryQuery] = useState('');

  const sidebarItems = GOVERNMENT_NAV.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  const rows = SCHEMES.map((scheme) => ({
    ...scheme,
    name: t(`government.schemes.${scheme.id}.name`),
    department: t(`government.schemes.${scheme.id}.department`),
  }));

  const filtered = rows.filter(
    (s) =>
      !query ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.department.toLowerCase().includes(query.toLowerCase()) ||
      s.id.toLowerCase().includes(query.toLowerCase())
  );

  const beneficiaries = selectedScheme ? BENEFICIARIES[selectedScheme.id] ?? [] : [];
  const filteredBeneficiaries = beneficiaries.filter(
    (b) =>
      !beneficiaryQuery ||
      b.name.toLowerCase().includes(beneficiaryQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(beneficiaryQuery.toLowerCase()) ||
      b.village.toLowerCase().includes(beneficiaryQuery.toLowerCase())
  );

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{
        title: t('government.schemesTitle'),
        subtitle: t('government.schemesSubtitle', { count: SCHEMES.length }),
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KPIWidget label={t('government.activeSchemes')} value={String(SCHEMES.length)} icon="health_and_safety" color="primary" sublabel={t('government.acrossDistrict')} />
        <KPIWidget label={t('government.totalRegistrations')} value={totalRegistrations.toLocaleString('en-IN')} icon="group_add" color="secondary" sublabel={t('government.averageCoverage', { value: averageCoverage })} />
        <KPIWidget label={t('government.allocatedBudget')} value={`₹${(totalBudget / 100000).toFixed(1)}L`} icon="account_balance_wallet" color="tertiary" sublabel={t('government.budgetAllocation')} />
      </div>

      <Card
        title={t('government.schemeRegistry')}
        subtitle={t('government.schemesShown', { count: filtered.length })}
        headerRight={<SearchBar placeholder={t('government.searchSchemes')} onSearch={setQuery} containerClassName="w-72" />}
      >
        {filtered.length === 0 ? (
          <p className="text-center text-on-surface-variant py-12">{t('government.noSchemesFound')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.scheme')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.department')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.budget')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.registered')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.coverage')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.status')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((scheme) => {
                  const coverage = Math.round((scheme.registrations / scheme.target) * 100);
                  return (
                  <tr
                    key={scheme.id}
                    className="border-b border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedScheme(scheme);
                      setBeneficiaryQuery('');
                    }}
                  >
                    <td className="px-6 py-4 min-w-[260px]">
                      <p className="font-semibold text-on-surface flex items-center gap-2">
                        {scheme.name}
                        <span className="material-symbols-outlined text-primary text-base">chevron_right</span>
                      </p>
                      <p className="font-mono text-label-sm text-primary">{scheme.id}</p>
                    </td>
                      <td className="px-6 py-4 text-on-surface-variant">{scheme.department}</td>
                      <td className="px-6 py-4 font-semibold text-on-surface">{scheme.budget}</td>
                      <td className="px-6 py-4 font-semibold text-primary">{scheme.registrations.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${coverage >= 70 ? 'bg-success' : coverage >= 40 ? 'bg-warning' : 'bg-error'}`}
                              style={{ width: `${Math.min(coverage, 100)}%` }}
                            />
                          </div>
                          <span className="text-label-md text-on-surface-variant whitespace-nowrap">{coverage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="success" dot>{scheme.status}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button size="sm" variant="outline" icon="group" onClick={() => { setSelectedScheme(scheme); setBeneficiaryQuery(''); }}>
                          {t('government.viewBeneficiaries')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selectedScheme)}
        onClose={() => setSelectedScheme(null)}
        title={selectedScheme ? `${selectedScheme.name} — ${t('government.viewBeneficiaries')}` : ''}
        icon="group"
        size="xl"
      >
        {selectedScheme && (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
              <div>
                <p className="font-bold text-on-surface">{t('government.registrationsCount', { count: selectedScheme.registrations.toLocaleString('en-IN') })}</p>
                <p className="text-label-md text-on-surface-variant">
                  {selectedScheme.department} · {t('government.showingOf', { shown: filteredBeneficiaries.length, total: beneficiaries.length })}
                </p>
              </div>
              <SearchBar placeholder={t('government.searchBeneficiaries')} onSearch={setBeneficiaryQuery} containerClassName="w-72" />
            </div>

            {filteredBeneficiaries.length === 0 ? (
              <p className="text-center text-on-surface-variant py-12">{t('government.noBeneficiariesFound')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-5 py-3 font-headline font-semibold">{t('government.name')}</th>
                      <th className="px-5 py-3 font-headline font-semibold">{t('government.beneficiaryId')}</th>
                      <th className="px-5 py-3 font-headline font-semibold">{t('government.village')}</th>
                      <th className="px-5 py-3 font-headline font-semibold">{t('government.age')}</th>
                      <th className="px-5 py-3 font-headline font-semibold">{t('government.gender')}</th>
                      <th className="px-5 py-3 font-headline font-semibold">{t('government.registeredOn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBeneficiaries.map((b) => (
                      <tr key={b.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-on-surface">{b.name}</p>
                          <p className="text-label-sm text-on-surface-variant">{b.village}</p>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-label-md text-primary">{b.id}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{b.village}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{b.age}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{b.gender}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{b.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </DashboardLayout>
  );
}
