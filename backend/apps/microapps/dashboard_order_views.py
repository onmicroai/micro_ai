"""
Per-user dashboard app ordering (global list + optional collection-specific list).
"""
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.collection.models import CollectionMaJoin, CollectionUserJoin
from apps.microapps.models import (
    MicroAppUserJoin,
    UserCollectionAppOrder,
    UserDashboardAppOrder,
)


def _accessible_ma_ids_for_user(user_id):
    return set(
        MicroAppUserJoin.objects.filter(
            user_id=user_id, is_archived=False
        ).values_list("ma_id", flat=True)
    )


def _merge_order_with_accessible(saved_ids_in_order, accessible_ids):
    """Drop stale ids, append missing accessible ids sorted by microapp pk."""
    accessible_ids = set(accessible_ids)
    seen = set()
    merged = []
    for pk in saved_ids_in_order:
        if pk in accessible_ids and pk not in seen:
            merged.append(pk)
            seen.add(pk)
    tail = sorted(accessible_ids - seen)
    merged.extend(tail)
    return merged


class DashboardGlobalAppOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = request.user.id
        accessible = _accessible_ma_ids_for_user(user_id)
        if not accessible:
            return Response(
                {"data": {"ordered_ids": None}, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )

        rows = UserDashboardAppOrder.objects.filter(user_id=user_id).order_by(
            "sort_index", "ma_id"
        )
        if not rows.exists():
            return Response(
                {"data": {"ordered_ids": None}, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )

        saved = list(rows.values_list("ma_id", flat=True))
        merged = _merge_order_with_accessible(saved, accessible)
        return Response(
            {"data": {"ordered_ids": merged}, "status": status.HTTP_200_OK},
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        user_id = request.user.id
        ordered_ids = request.data.get("ordered_ids")
        if not isinstance(ordered_ids, list):
            return Response(
                {"error": "ordered_ids must be a list of app ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            ordered_ids = [int(x) for x in ordered_ids]
        except (TypeError, ValueError):
            return Response(
                {"error": "ordered_ids must contain integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        accessible = _accessible_ma_ids_for_user(user_id)
        if set(ordered_ids) != accessible:
            return Response(
                {
                    "error": "ordered_ids must be a permutation of all apps you can access."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            UserDashboardAppOrder.objects.filter(user_id=user_id).delete()
            UserDashboardAppOrder.objects.bulk_create(
                [
                    UserDashboardAppOrder(
                        user_id=user_id, ma_id=pk, sort_index=i
                    )
                    for i, pk in enumerate(ordered_ids)
                ]
            )

        return Response(
            {"data": {"ordered_ids": ordered_ids}, "status": status.HTTP_200_OK},
            status=status.HTTP_200_OK,
        )


def _collection_visible_ma_ids(user_id, collection_id):
    if not CollectionUserJoin.objects.filter(
        collection_id=collection_id, user_id=user_id
    ).exists():
        return None
    in_collection = set(
        CollectionMaJoin.objects.filter(collection_id=collection_id).values_list(
            "ma_id", flat=True
        )
    )
    if not in_collection:
        return set()
    return set(
        MicroAppUserJoin.objects.filter(
            user_id=user_id,
            is_archived=False,
            ma_id__in=in_collection,
        ).values_list("ma_id", flat=True)
    )


class DashboardCollectionAppOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id):
        user_id = request.user.id
        visible = _collection_visible_ma_ids(user_id, collection_id)
        if visible is None:
            return Response(
                {"error": "You do not have access to this collection."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not visible:
            return Response(
                {"data": {"ordered_ids": None}, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )

        rows = UserCollectionAppOrder.objects.filter(
            user_id=user_id, collection_id=collection_id
        ).order_by("sort_index", "ma_id")
        if not rows.exists():
            return Response(
                {"data": {"ordered_ids": None}, "status": status.HTTP_200_OK},
                status=status.HTTP_200_OK,
            )

        saved = list(rows.values_list("ma_id", flat=True))
        merged = _merge_order_with_accessible(saved, visible)
        return Response(
            {"data": {"ordered_ids": merged}, "status": status.HTTP_200_OK},
            status=status.HTTP_200_OK,
        )

    def put(self, request, collection_id):
        user_id = request.user.id
        visible = _collection_visible_ma_ids(user_id, collection_id)
        if visible is None:
            return Response(
                {"error": "You do not have access to this collection."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ordered_ids = request.data.get("ordered_ids")
        if not isinstance(ordered_ids, list):
            return Response(
                {"error": "ordered_ids must be a list of app ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            ordered_ids = [int(x) for x in ordered_ids]
        except (TypeError, ValueError):
            return Response(
                {"error": "ordered_ids must contain integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if set(ordered_ids) != visible:
            return Response(
                {
                    "error": "ordered_ids must list every app in this collection that you can see."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            UserCollectionAppOrder.objects.filter(
                user_id=user_id, collection_id=collection_id
            ).delete()
            UserCollectionAppOrder.objects.bulk_create(
                [
                    UserCollectionAppOrder(
                        user_id=user_id,
                        collection_id=collection_id,
                        ma_id=pk,
                        sort_index=i,
                    )
                    for i, pk in enumerate(ordered_ids)
                ]
            )

        return Response(
            {"data": {"ordered_ids": ordered_ids}, "status": status.HTTP_200_OK},
            status=status.HTTP_200_OK,
        )
