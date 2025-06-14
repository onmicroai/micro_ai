/* tslint:disable */
/* eslint-disable */
/**
 * Micro AI
 * Build Micro Apps with No Code
 *
 * The version of the OpenAPI document: 0.1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { mapValues } from '../runtime';
import type { Invitation } from './Invitation';
import {
    InvitationFromJSON,
    InvitationFromJSONTyped,
    InvitationToJSON,
} from './Invitation';

/**
 * 
 * @export
 * @interface PaginatedInvitationList
 */
export interface PaginatedInvitationList {
    /**
     * 
     * @type {number}
     * @memberof PaginatedInvitationList
     */
    count: number;
    /**
     * 
     * @type {string}
     * @memberof PaginatedInvitationList
     */
    next?: string;
    /**
     * 
     * @type {string}
     * @memberof PaginatedInvitationList
     */
    previous?: string;
    /**
     * 
     * @type {Array<Invitation>}
     * @memberof PaginatedInvitationList
     */
    results: Array<Invitation>;
}

/**
 * Check if a given object implements the PaginatedInvitationList interface.
 */
export function instanceOfPaginatedInvitationList(value: object): boolean {
    if (!('count' in value)) return false;
    if (!('results' in value)) return false;
    return true;
}

export function PaginatedInvitationListFromJSON(json: any): PaginatedInvitationList {
    return PaginatedInvitationListFromJSONTyped(json, false);
}

export function PaginatedInvitationListFromJSONTyped(json: any, ignoreDiscriminator: boolean): PaginatedInvitationList {
    if (json == null) {
        return json;
    }
    return {
        
        'count': json['count'],
        'next': json['next'] == null ? undefined : json['next'],
        'previous': json['previous'] == null ? undefined : json['previous'],
        'results': ((json['results'] as Array<any>).map(InvitationFromJSON)),
    };
}

export function PaginatedInvitationListToJSON(value?: PaginatedInvitationList | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'count': value['count'],
        'next': value['next'],
        'previous': value['previous'],
        'results': ((value['results'] as Array<any>).map(InvitationToJSON)),
    };
}

