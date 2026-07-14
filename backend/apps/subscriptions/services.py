import logging
from django.db import transaction
from apps.subscriptions.models import Coupon, CouponUsage
from apps.subscriptions.helpers import set_user_max_apps

logger = logging.getLogger(__name__)

class CouponActionService:
    """Service class to handle coupon action execution"""
    
    @staticmethod
    def execute_action(coupon, user):
        """
        Execute the action specified by the coupon for the given user
        
        Args:
            coupon: Coupon instance
            user: User instance
            
        Returns:
            dict: Result with success status and message
        """
        try:
            if coupon.action == 'increase_max_apps':
                return CouponActionService._execute_increase_max_apps(coupon, user)
            elif coupon.action == 'increase_max_apps_and_credits':
                return CouponActionService._execute_increase_max_apps_and_credits(coupon, user)
            else:
                return {
                    'success': False,
                    'message': f'Unknown action: {coupon.action}'
                }
        except Exception as e:
            logger.error(f"Error executing coupon action {coupon.action}: {str(e)}")
            return {
                'success': False,
                'message': f'Error executing action: {str(e)}'
            }
    
    @staticmethod
    def _execute_increase_max_apps(coupon, user):
        """
        Execute the increase_max_apps action
        
        Args:
            coupon: Coupon instance
            user: User instance
            
        Returns:
            dict: Result with success status and max_apps value
        """
        try:
            max_apps = coupon.get_action_value('max_apps')
            if not max_apps:
                return {
                    'success': False,
                    'message': 'max_apps value not found in coupon data'
                }

            set_user_max_apps(user, max_apps)
            
            return {
                'success': True,
                'message': f'Successfully set max_apps to {max_apps}',
                'max_apps': max_apps
            }
        except Exception as e:
            logger.error(f"Error in increase_max_apps action: {str(e)}")
            return {
                'success': False,
                'message': f'Error updating max_apps: {str(e)}'
            } 

    @staticmethod
    def _execute_increase_max_apps_and_credits(coupon, user):
        """
        Execute the increase_max_apps_and_credits action
        
        Args:
            coupon: Coupon instance
            user: User instance
            
        Returns:
            dict: Result with success status and values
        """
        try:
            max_apps = coupon.get_action_value('max_apps')
            credits = coupon.get_action_value('credits')
            
            if not max_apps:
                return {
                    'success': False,
                    'message': 'max_apps value not found in coupon data'
                }
            
            if not credits:
                return {
                    'success': False,
                    'message': 'credits value not found in coupon data'
                }

            with transaction.atomic():
                set_user_max_apps(user, max_apps)
                from apps.subscriptions.credits import grant_topup_credits
                grant_topup_credits(user, credits, reason="coupon")
            
            return {
                'success': True,
                'message': f'Successfully set max_apps to {max_apps} and added {credits:,} credits',
                'max_apps': max_apps,
                'credits': credits
            }
        except Exception as e:
            logger.error(f"Error in increase_max_apps_and_credits action: {str(e)}")
            return {
                'success': False,
                'message': f'Error updating max_apps and credits: {str(e)}'
            }
