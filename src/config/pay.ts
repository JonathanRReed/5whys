import provenance from '../../public/data/pay/provenance.json';

/**
 * True once the public wage files have been built into the site. Until then
 * Pay ships the offer worksheet and the job-title search, and no page may
 * describe wage figures it does not have.
 */
export const hasWages = (provenance as { status?: string }).status !== 'titles-only';
