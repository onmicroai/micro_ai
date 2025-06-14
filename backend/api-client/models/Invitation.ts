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
import type { RoleEnum } from './RoleEnum';
import {
    RoleEnumFromJSON,
    RoleEnumFromJSONTyped,
    RoleEnumToJSON,
} from './RoleEnum';

/**
 * 
 * @export
 * @interface Invitation
 */
export interface Invitation {
    /**
     * 
     * @type {string}
     * @memberof Invitation
     */
    readonly id: string;
    /**
     * 
     * @type {string}
     * @memberof Invitation
     */
    email: string;
    /**
     * 
     * @type {RoleEnum}
     * @memberof Invitation
     */
    role?: RoleEnum;
    /**
     * 
     * @type {string}
     * @memberof Invitation
     */
    readonly invitedBy: string;
    /**
     * 
     * @type {boolean}
     * @memberof Invitation
     */
    isAccepted?: boolean;
}

/**
 * Check if a given object implements the Invitation interface.
 */
export function instanceOfInvitation(value: object): boolean {
    if (!('id' in value)) return false;
    if (!('email' in value)) return false;
    if (!('invitedBy' in value)) return false;
    return true;
}

export function InvitationFromJSON(json: any): Invitation {
    return InvitationFromJSONTyped(json, false);
}

export function InvitationFromJSONTyped(json: any, ignoreDiscriminator: boolean): Invitation {
    if (json == null) {
        return json;
    }
    return {
        
        'id': json['id'],
        'email': json['email'],
        'role': json['role'] == null ? undefined : RoleEnumFromJSON(json['role']),
        'invitedBy': json['invited_by'],
        'isAccepted': json['is_accepted'] == null ? undefined : json['is_accepted'],
    };
}

export function InvitationToJSON(value?: Omit<Invitation, 'id'|'invited_by'> | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'email': value['email'],
        'role': RoleEnumToJSON(value['role']),
        'is_accepted': value['isAccepted'],
    };
}

